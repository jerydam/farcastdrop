import {Interface, type BrowserProvider, Contract, JsonRpcProvider, ZeroAddress, isAddress, getAddress } from "ethers"
import { FAUCET_ABI_DROPCODE, FAUCET_ABI_CUSTOM, FAUCET_ABI_DROPLIST, ERC20_ABI, CHECKIN_ABI, FACTORY_ABI_DROPCODE, FACTORY_ABI_DROPLIST, FACTORY_ABI_CUSTOM, STORAGE_ABI} from "./abis"
import { appendDivviReferralData, reportTransactionToDivvi, getDivviStatus, isSupportedNetwork } from "./divvi-integration"

// Fetch faucets for a specific network using getAllFaucets and getFaucetDetails
interface Network {
  chainId: bigint
  name: string
  rpcUrl: string
  blockExplorer: string
  factoryAddresses: string[] // Changed to array to handle multiple addresses
  color: string
  storageAddress?: string // Optional, defaults to FAUCET_STORAGE_ADDRESS
}
interface FaucetMeta {
    faucetAddress: string;
    isClaimActive: boolean;
    isEther: boolean;
    createdAt: number | string;
    tokenSymbol?: string;
    name?: string;
    owner?: string;
    factoryAddress: string; // CRITICAL for step 2
}
interface DeletedFaucetResponse {
    success: boolean;
    count: number;
    deletedAddresses: string[];
}
// Factory type definitions
export type FactoryType = 'dropcode' | 'droplist' | 'custom'

// Faucet type definitions (matches factory types)
type FaucetType = 'dropcode' | 'droplist' | 'custom'

interface FaucetConfig {
  abi: any[]
}

// Helper function to get the appropriate faucet ABI based on faucet type
function getFaucetConfig(faucetType: FaucetType): FaucetConfig {
  switch (faucetType) {
    case 'dropcode':
      return { abi: FAUCET_ABI_DROPCODE }
    case 'droplist':
      return { abi: FAUCET_ABI_DROPLIST }
    case 'custom':
      return { abi: FAUCET_ABI_CUSTOM }
    default:
      throw new Error(`Unknown faucet type: ${faucetType}`)
  }
}

// Assuming these interfaces exist
interface FactoryConfig {
  abi: any; // Factory ABI
  faucetAbi: any; // 💡 NEW: Faucet ABI
  createFunction: string;
}

// Helper function to get the appropriate ABI and function based on factory type
function getFactoryConfig(factoryType: FactoryType): FactoryConfig {
  switch (factoryType) {
    case 'dropcode':
      return { 
        abi: FACTORY_ABI_DROPCODE, 
        faucetAbi: FAUCET_ABI_DROPCODE, // 💡 ADDED
        createFunction: 'createBackendFaucet' 
      }
    case 'droplist':
      return { 
        abi: FACTORY_ABI_DROPLIST, 
        faucetAbi: FAUCET_ABI_DROPLIST, // 💡 ADDED
        createFunction: 'createWhitelistFaucet' 
      }
    case 'custom':
      return { 
        abi: FACTORY_ABI_CUSTOM, 
        faucetAbi: FAUCET_ABI_CUSTOM, // 💡 ADDED
        createFunction: 'createCustomFaucet' 
      }
    default:
      throw new Error(`Unknown factory type: ${factoryType}`)
  }
}

// Helper function to determine factory type based on useBackend and custom flags
function determineFactoryType(useBackend: boolean, isCustom: boolean = false): FactoryType {
  if (isCustom) {
    return 'custom'
  }
  return useBackend ? 'dropcode' : 'droplist'
}

/**
 * 💡 NEW HELPER: Safely estimate gas with a fallback to prevent UI crashes.
 * This fixes "gas estimate error" on Farcaster/Base when RPC simulation fails.
 */
/**
 * 💡 HELPER: Safely estimate gas with a fallback to prevent UI crashes.
 */
async function estimateGasWithFallback(
  provider: BrowserProvider | JsonRpcProvider,
  txParams: any,
  fallbackGas: bigint = BigInt(3000000)
): Promise<bigint> {
  try {
    const estimated = await provider.estimateGas(txParams);
    // Add 20% buffer to the estimate for safety
    return (estimated * BigInt(120)) / BigInt(100);
  } catch (error: any) {
    console.warn("⚠️ Gas estimation failed, using fallback:", error.message);
    return fallbackGas;
  }
}

/**
 * 💡 CRITICAL FIX: Safe Wait For Receipt
 * Handles "Provider does not support eth_getTransactionReceipt" (Error 4200)
 * by polling the RPC provider directly if the Wallet refuses to answer.
 */
async function safeWaitForReceipt(
    tx: any, 
    provider: BrowserProvider | JsonRpcProvider
) {
    try {
        // 1. Try standard wait first
        return await tx.wait();
    } catch (error: any) {
        const msg = error?.message || "";
        const code = error?.code;
        
        // 2. Catch compatibility errors (MiniPay, Farcaster, etc.)
        if (
            msg.includes("support") || 
            msg.includes("eth_getTransactionReceipt") || 
            code === 4200 || 
            code === "UNKNOWN_ERROR"
        ) {
            console.warn("⚠️ Wallet blocked receipt call. Polling RPC directly...", tx.hash);
            
            // 3. Poll the provider manually for ~60 seconds
            let attempts = 0;
            while (attempts < 30) { 
                await new Promise(r => setTimeout(r, 2000)); // Wait 2s
                try {
                    const receipt = await provider.getTransactionReceipt(tx.hash);
                    if (receipt) {
                        console.log("✅ Receipt found via manual polling");
                        return receipt;
                    }
                } catch (e) {
                    // Ignore network errors during polling
                }
                attempts++;
            }
        }
        // If it wasn't a compatibility error, or polling timed out, re-throw
        throw error;
    }
}

// Helper function to detect factory type by trying different function calls
async function detectFactoryType(provider: BrowserProvider | JsonRpcProvider, factoryAddress: string): Promise<FactoryType> {
  const factoryTypes: FactoryType[] = ['dropcode', 'droplist', 'custom']
  
  for (const type of factoryTypes) {
    try {
      const config = getFactoryConfig(type)
      const contract = new Contract(factoryAddress, config.abi, provider)
      
      // Try to call a function that exists in this ABI
      await contract[config.createFunction].staticCall("test", ZeroAddress, ZeroAddress)
      return type
    } catch (error: any) {
      // If the function doesn't exist, try the next type
      if (error.message?.includes('function') && error.message?.includes('not found')) {
        continue
      }
      // If it's a different error (like invalid parameters), the function exists
      return type
    }
  }
  
  // Default to dropcode if detection fails
  console.warn(`Could not detect factory type for ${factoryAddress}, defaulting to dropcode`)
  return 'dropcode'
}

export async function getFaucetDetailsFromFactory(
    factoryAddress: string, // Needed to determine type/ABI later if not cached
    faucetAddress: string,
    provider: BrowserProvider | JsonRpcProvider
): Promise<any> {
    try {
        console.log(`[getFaucetDetailsFromFactory] Fetching full details for ${faucetAddress} from factory ${factoryAddress}`);

        // 1. Detect faucet type using the known factory address (this is a shortcut)
        const factoryType = await detectFactoryType(provider, factoryAddress);
        const faucetType = factoryType as FaucetType;

        // 2. Call the existing getFaucetDetails function, passing the detected type
        const details = await getFaucetDetails(provider, faucetAddress, faucetType);

        // 3. Return the full details, including the factory address for context
        return {
            ...details,
            factoryAddress: factoryAddress,
            faucetType: faucetType,
        };
    } catch (error) {
        console.error(`Error in getFaucetDetailsFromFactory for ${faucetAddress}:`, error);
        throw error;
    }
}

// Helper function to detect faucet type by trying different ABIs
async function detectFaucetType(provider: BrowserProvider | JsonRpcProvider, faucetAddress: string): Promise<FaucetType> {
  const faucetTypes: FaucetType[] = ['dropcode', 'droplist', 'custom']
  
  for (const type of faucetTypes) {
    try {
      const config = getFaucetConfig(type)
      const contract = new Contract(faucetAddress, config.abi, provider)
      
      // Try to call a common function that should exist in all faucet types
      await contract.name.staticCall()
      
      // If we got here, the ABI works. Let's do additional validation
      // Check for type-specific functions
      if (type === 'droplist') {
        // Droplist should have whitelist functions
        try {
          await contract.isWhitelisted.staticCall(ZeroAddress)
          return 'droplist'
        } catch {
          continue
        }
      } else if (type === 'custom') {
        // Custom should have custom claim amount functions
        try {
          await contract.getCustomClaimAmount.staticCall(ZeroAddress)
          return 'custom'
        } catch {
          continue
        }
      } else if (type === 'dropcode') {
        // Dropcode should have claimAmount but not whitelist or custom functions
        try {
          await contract.claimAmount.staticCall()
          // Make sure it doesn't have droplist or custom specific functions
          try {
            await contract.isWhitelisted.staticCall(ZeroAddress)
            continue // Has whitelist, so it's not dropcode
          } catch {
            try {
              await contract.getCustomClaimAmount.staticCall(ZeroAddress)
              continue // Has custom amounts, so it's not dropcode
            } catch {
              return 'dropcode' // No whitelist or custom functions, must be dropcode
            }
          }
        } catch {
          continue
        }
      }
    } catch (error: any) {
      continue
    }
  }
  
  // Default to dropcode if detection fails
  console.warn(`Could not detect faucet type for ${faucetAddress}, defaulting to dropcode`)
  return 'dropcode'
}

// Helper function to get faucet type from factory address and factory type
async function getFaucetTypeFromFactory(
  provider: BrowserProvider | JsonRpcProvider,
  faucetAddress: string,
  networks: Network[]
): Promise<FaucetType> {
  try {
    // Try to find which factory created this faucet
    for (const network of networks) {
      for (const factoryAddress of network.factoryAddresses) {
        try {
          const factoryType = await detectFactoryType(provider, factoryAddress)
          const config = getFactoryConfig(factoryType)
          const factoryContract = new Contract(factoryAddress, config.abi, provider)
          
          // Check if this faucet exists in this factory
          const faucets = await factoryContract.getAllFaucets()
          if (faucets.includes(faucetAddress)) {
            // Faucet type matches factory type
            return factoryType
          }
        } catch (error) {
          continue
        }
      }
    }
  } catch (error) {
    console.warn(`Could not determine faucet type from factory for ${faucetAddress}:`, error)
  }
  
  // Fallback to direct detection
  return await detectFaucetType(provider, faucetAddress)
}

// Mapping of networkName to native token symbol
const NATIVE_TOKEN_MAP: Record<string, string> = {
  Celo: "CELO",
  Lisk: "LISK",
  Arbitrum: "ETH",
  Base: "ETH",
}

// Interfaces
interface FaucetDetails {
  faucetAddress: string;
  owner: string;
  name: string;
  claimAmount: bigint;
  tokenAddress: string;
  startTime: bigint;
  endTime: bigint;
  isClaimActive: boolean;
  balance: bigint;
  isEther: boolean;
  useBackend: boolean;
}

export interface NameValidationResult {
  exists: boolean;
  existingFaucet?: { 
    address: string; 
    name: string; 
    owner: string 
  };
  warning?: string;
}

// Load backend address from .env
const BACKEND_ADDRESS = process.env.BACKEND_ADDRESS || "0x9fBC2A0de6e5C5Fd96e8D11541608f5F328C0785"

// Storage contract address
const STORAGE_CONTRACT_ADDRESS = "0xc26c4Ea50fd3b63B6564A5963fdE4a3A474d4024"

// transactions contract address
const CHECKIN_CONTRACT_ADDRESS = "0x051dDcB3FaeA6004fD15a990d753449F81733440"

// Celo RPC URL
const CELO_RPC_URL = "https://forno.celo.org"

if (!isAddress(BACKEND_ADDRESS)) {
  throw new Error(`Invalid BACKEND_ADDRESS in .env: ${BACKEND_ADDRESS}`)
}

const VALID_BACKEND_ADDRESS = getAddress(BACKEND_ADDRESS)

const faucetDetailsCache: Map<string, any> = new Map()

// LocalStorage keys
const STORAGE_KEYS = {
  CHECKIN_DATA: "faucet_checkin_data",
  CHECKIN_LAST_BLOCK: "faucet_checkin_last_block",
  STORAGE_DATA: "faucet_storage_data",
  STORAGE_LAST_BLOCK: "faucet_storage_last_block",
  NEW_USERS_DATA: "faucet_new_users_data",
  CACHE_TIMESTAMP: "faucet_cache_timestamp",
}

// Cache duration (1 hour)
const CACHE_DURATION = 60 * 60 * 1000

// Helper to check network
function checkNetwork(chainId: bigint, networkId: bigint): boolean {
  console.log(`Checking network: chainId=${chainId}, networkId=${networkId}`)
  return chainId === networkId
}

// Check permissions and contract state with faucet type detection
async function checkPermissions(
  provider: BrowserProvider,
  faucetAddress: string,
  callerAddress: string,
  faucetType?: FaucetType
): Promise<{ isOwner: boolean; isAdmin: boolean; isPaused: boolean }> {
  try {
    // Detect faucet type if not provided
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    
    const faucetContract = new Contract(faucetAddress, config.abi, provider);
    const [owner, adminsResponse, isPaused] = await Promise.all([
      faucetContract.owner(),
      faucetContract.getAllAdmins(),
      faucetContract.paused(),
    ]);
    // Flatten the admins array
    const admins = Array.isArray(adminsResponse)
      ? adminsResponse.flat().filter((admin: string) => isAddress(admin))
      : [];
    const isAdmin = admins.some((admin: string) => admin.toLowerCase() === callerAddress.toLowerCase());
    console.log(
      `Permissions for ${callerAddress}: isOwner=${owner.toLowerCase() === callerAddress.toLowerCase()}, isAdmin=${isAdmin}, isPaused=${isPaused}`,
    );
    return {
      isOwner: owner.toLowerCase() === callerAddress.toLowerCase(),
      isAdmin,
      isPaused,
    };
  } catch (error: any) {
    console.error(`Error checking permissions for ${faucetAddress}:`, error);
    throw new Error("Failed to check permissions");
  }
}

export function getFromStorage(key: string): any {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch (error) {
    console.warn(`Error reading from localStorage key ${key}:`, error)
    return null
  }
}

export function saveToStorage(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.warn(`Error saving to localStorage key ${key}:`, error)
  }
}

function isCacheValid(): boolean {
  const timestamp = getFromStorage(STORAGE_KEYS.CACHE_TIMESTAMP)
  if (!timestamp) return false
  return Date.now() - timestamp < CACHE_DURATION
}

function updateCacheTimestamp(): void {
  saveToStorage(STORAGE_KEYS.CACHE_TIMESTAMP, Date.now())
}

// Helper to check if the network is Celo
export function isCeloNetwork(chainId: bigint): boolean {
  return chainId === BigInt(42220) // Celo Mainnet
}

// Fetch transactions data from Celo with incremental loading
export async function fetchCheckInData(): Promise<{
  transactionsByDate: { [date: string]: number }
  usersByDate: { [date: string]: Set<string> }
  allUsers: Set<string>
}> {
  try {
    const provider = new JsonRpcProvider(CELO_RPC_URL)
    const contract = new Contract(CHECKIN_CONTRACT_ADDRESS, CHECKIN_ABI, provider)

    // Check if we have cached data and if it's still valid
    const cachedData = getFromStorage(STORAGE_KEYS.CHECKIN_DATA)
    const lastBlock = getFromStorage(STORAGE_KEYS.CHECKIN_LAST_BLOCK) || 0

    let transactionsByDate: { [date: string]: number } = {}
    let usersByDate: { [date: string]: Set<string> } = {}
    let allUsers: Set<string> = new Set()

    // Load cached data if available
    if (cachedData && isCacheValid()) {
      transactionsByDate = cachedData.transactionsByDate || {}
      usersByDate = {}
      // Convert cached user data back to Sets
      Object.entries(cachedData.usersByDate || {}).forEach(([date, users]) => {
        usersByDate[date] = new Set(users as string[])
      })
      allUsers = new Set(cachedData.allUsers || [])
      console.log("Loaded cached transactions data")
    }

    // Get current block number
    const currentBlock = await provider.getBlockNumber()
    console.log(`Current block: ${currentBlock}, Last processed: ${lastBlock}`)

    // Only fetch new events if there are new blocks
    if (currentBlock > lastBlock) {
      const fromBlock = Math.max(lastBlock + 1, currentBlock - 10000) // Limit to last 10k blocks to avoid RPC issues

      console.log(`Fetching CheckedIn events from block ${fromBlock} to ${currentBlock}`)

      try {
        const filter = contract.filters.CheckedIn()
        const events = await contract.queryFilter(filter, fromBlock, currentBlock)

        console.log(`Found ${events.length} new transactions events`)

        // Process new events
        for (const event of events) {
          try {
            const block = await provider.getBlock(event.blockNumber)
            if (block && "args" in event && event.args) {
              const date = new Date(block.timestamp * 1000).toISOString().split("T")[0]
              const user = event.args.user.toLowerCase()

              // Update transactions by date
              transactionsByDate[date] = (transactionsByDate[date] || 0) + 1

              // Track users by date
              if (!usersByDate[date]) {
                usersByDate[date] = new Set()
              }
              usersByDate[date].add(user)
              allUsers.add(user)
            }
          } catch (blockError) {
            console.warn(`Error processing block ${event.blockNumber}:`, blockError)
          }
        }

        // Save updated data to localStorage
        const dataToCache = {
          transactionsByDate,
          usersByDate: Object.fromEntries(
            Object.entries(usersByDate).map(([date, users]) => [date, Array.from(users)]),
          ),
          allUsers: Array.from(allUsers),
        }

        saveToStorage(STORAGE_KEYS.CHECKIN_DATA, dataToCache)
        saveToStorage(STORAGE_KEYS.CHECKIN_LAST_BLOCK, currentBlock)
        updateCacheTimestamp()

        console.log("Updated transactions cache")
      } catch (queryError) {
        console.error("Error querying transactions events:", queryError)
        // If query fails, use cached data
      }
    }

    return { transactionsByDate, usersByDate, allUsers }
  } catch (error) {
    console.error("Error fetching transactions data:", error)

    // Return cached data if available
    const cachedData = getFromStorage(STORAGE_KEYS.CHECKIN_DATA)
    if (cachedData) {
      const usersByDate: { [date: string]: Set<string> } = {}
      Object.entries(cachedData.usersByDate || {}).forEach(([date, users]) => {
        usersByDate[date] = new Set(users as string[])
      })

      return {
        transactionsByDate: cachedData.transactionsByDate || {},
        usersByDate,
        allUsers: new Set(cachedData.allUsers || []),
      }
    }

    return { transactionsByDate: {}, usersByDate: {}, allUsers: new Set() }
  }
}

// Fetch storage contract data with incremental loading
export async function fetchStorageData(): Promise<
  {
    claimer: string
    faucet: string
    amount: bigint
    txHash: `0x${string}`
    networkName: string
    timestamp: number
    tokenSymbol: string
    tokenDecimals: number
    isEther: boolean
  }[]
> {
  try {
    const provider = new JsonRpcProvider(CELO_RPC_URL)

    // Check if storage contract exists
    const code = await provider.getCode(STORAGE_CONTRACT_ADDRESS)
    if (code === "0x") {
      console.log("Storage contract not deployed on Celo")
      return []
    }

    const contract = new Contract(STORAGE_CONTRACT_ADDRESS, STORAGE_ABI, provider)

    // Check cached data
    const cachedData = getFromStorage(STORAGE_KEYS.STORAGE_DATA)
    if (cachedData && isCacheValid()) {
      console.log("Using cached storage data")
      return cachedData.map((claim: any) => ({
        ...claim,
        amount: BigInt(claim.amount),
      }))
    }

    // Fetch all claims from storage contract
    console.log("Fetching all claims from storage contract...")
    const claims: any[] = await contract.getAllClaims()
    console.log(`Found ${claims.length} claims in storage contract`)

    // Process claims
    const formattedClaims = await Promise.all(
      claims.map(async (claim: any) => {
        let tokenSymbol = "CELO"
        let tokenDecimals = 18
        let isEther = true

        // Try to get faucet details for token info
        try {
          const faucetDetails = await getFaucetDetails(provider, claim.faucet)
          tokenSymbol = faucetDetails.tokenSymbol
          tokenDecimals = faucetDetails.tokenDecimals
          isEther = faucetDetails.isEther
        } catch (error) {
          console.warn(`Error fetching faucet details for ${claim.faucet}:`, error)
        }

        return {
          claimer: claim.claimer as string,
          faucet: claim.faucet as string,
          amount: claim.amount, // Keep as string for storage
          txHash: claim.txHash as `0x${string}`,
          networkName: claim.networkName as string,
          timestamp: Number(claim.timestamp),
          tokenSymbol,
          tokenDecimals,
          isEther,
        }
      }),
    )

    // Cache the data
    saveToStorage(STORAGE_KEYS.STORAGE_DATA, formattedClaims)
    updateCacheTimestamp()

    // Convert amounts back to BigInt for return
    return formattedClaims.map((claim) => ({
      ...claim,
      amount: BigInt(claim.amount),
    }))
  } catch (error) {
    console.error("Error fetching storage data:", error)

    // Return cached data if available
    const cachedData = getFromStorage(STORAGE_KEYS.STORAGE_DATA)
    if (cachedData) {
      return cachedData.map((claim: any) => ({
        ...claim,
        amount: BigInt(claim.amount),
      }))
    }

    return []
  }
}

export async function createCustomFaucet(
    provider: BrowserProvider,
    factoryAddress: string,
    questName: string,
    tokenAddress: string,
): Promise<string> {
    if (!isAddress(factoryAddress) || !isAddress(tokenAddress)) throw new Error(`Invalid factory or token address.`);
    if (!provider) throw new Error("Ethers provider is not available.");

    try {
        const factoryType: FactoryType = 'custom';
        const config = getFactoryConfig(factoryType); 
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();
        const backendAddress = VALID_BACKEND_ADDRESS; 
        const factoryContract = new Contract(factoryAddress, config.abi, signer);
        const data = factoryContract.interface.encodeFunctionData(config.createFunction, [
            questName, tokenAddress, backendAddress,
        ]);
        
        const gasLimit = await estimateGasWithFallback(provider, {
            to: factoryAddress, data: data, from: signerAddress, value: BigInt(0)
        }, BigInt(1500000)); 

        const tx = await signer.sendTransaction({
            to: factoryAddress, data: data, gasLimit: gasLimit,
        });

        // 💡 UPDATED: Safe wait
        const receipt = await safeWaitForReceipt(tx, provider);
        if (!receipt) throw new Error("Transaction receipt is null.");
        
        let newFaucetAddress: string | null = null;
        const factoryInterface = new Interface(config.abi);

        if (receipt.logs) {
            for (const log of receipt.logs) {
                try {
                    const parsedLog = factoryInterface.parseLog(log as any);
                    if (parsedLog && parsedLog.name === 'FaucetCreated') {
                        newFaucetAddress = parsedLog.args.faucet;
                        break;
                    }
                } catch (e) { }
            }
        }
        
        if (newFaucetAddress) {
            console.log(`✅ New faucet deployed at: ${newFaucetAddress}`);
            return newFaucetAddress;
        }
        throw new Error("Deployment succeeded, but the FaucetCreated event was not found.");
    } catch (error: any) {
        console.error('❌ Error deploying custom faucet:', error);
        throw new Error(error.reason || error.message || "Failed to deploy custom faucet");
    }
}

export async function checkFaucetNameExistsAcrossAllFactories(
  provider: BrowserProvider | JsonRpcProvider,
  factoryAddresses: string[],
  proposedName: string
): Promise<NameValidationResult & { 
  conflictingFaucets?: Array<{
    address: string
    name: string
    owner: string
    factoryAddress: string
    factoryType: FactoryType
  }>
}> {
  try {
    if (!proposedName.trim()) {
      throw new Error("Faucet name cannot be empty");
    }
    
    const normalizedProposedName = proposedName.trim().toLowerCase();
    console.log(`Checking name "${proposedName}" across ${factoryAddresses.length} factories on current network...`);

    const conflictingFaucets: any[] = [];

    // Check each factory address
    for (const factoryAddress of factoryAddresses) {
      if (!isAddress(factoryAddress)) {
        console.warn(`Invalid factory address ${factoryAddress}, skipping`);
        continue;
      }

      try {
        // Check if factory contract exists
        const code = await provider.getCode(factoryAddress);
        if (code === "0x") {
          console.warn(`No contract at factory address ${factoryAddress}`);
          continue;
        }

        // Detect factory type and get appropriate ABI
        let factoryType: FactoryType;
        let config: FactoryConfig;
        
        try {
          factoryType = await detectFactoryType(provider, factoryAddress);
          config = getFactoryConfig(factoryType);
          console.log(`Checking factory ${factoryAddress} (type: ${factoryType})`);
        } catch (error) {
          console.warn(`Could not detect factory type for ${factoryAddress}, skipping:`, error);
          continue;
        }

        const factoryContract = new Contract(factoryAddress, config.abi, provider);

        // Method 1: Try getAllFaucetDetails first (preferred method)
        try {
          console.log(`Attempting getAllFaucetDetails for factory ${factoryAddress}...`);
          const allFaucetDetails: FaucetDetails[] = await factoryContract.getAllFaucetDetails();
          
          const conflictInThisFactory = allFaucetDetails.find(faucet => 
            faucet.name.toLowerCase() === normalizedProposedName
          );
          
          if (conflictInThisFactory) {
            conflictingFaucets.push({
              address: conflictInThisFactory.faucetAddress,
              name: conflictInThisFactory.name,
              owner: conflictInThisFactory.owner,
              factoryAddress,
              factoryType
            });
          }
          
        } catch (getAllError: any) {
          console.warn(`getAllFaucetDetails failed for factory ${factoryAddress}, trying fallback method:`, getAllError.message);
          
          // Method 2: Fallback - Get all faucet addresses and check each individually
          try {
            console.log(`Attempting getAllFaucets fallback for factory ${factoryAddress}...`);
            const faucetAddresses: string[] = await factoryContract.getAllFaucets();
            
            console.log(`Found ${faucetAddresses.length} faucets in factory ${factoryAddress}`);
            
            // Check each faucet individually (with batching for performance)
            const batchSize = 10; // Process in smaller batches
            
            for (let i = 0; i < faucetAddresses.length; i += batchSize) {
              const batch = faucetAddresses.slice(i, i + batchSize);
              
              // Process batch in parallel
              const batchPromises = batch.map(async (faucetAddress) => {
                try {
                  const faucetDetails = await factoryContract.getFaucetDetails(faucetAddress);
                  return {
                    address: faucetAddress,
                    name: faucetDetails.name,
                    owner: faucetDetails.owner,
                    factoryAddress,
                    factoryType
                  };
                } catch (error: any) {
                  console.warn(`Failed to get details for faucet ${faucetAddress}:`, error.message);
                  return null;
                }
              });
              
              const batchResults = await Promise.allSettled(batchPromises);
              
              // Check this batch for name conflicts
              for (const result of batchResults) {
                if (result.status === 'fulfilled' && result.value) {
                  const faucet = result.value;
                  if (faucet.name.toLowerCase() === normalizedProposedName) {
                    conflictingFaucets.push(faucet);
                  }
                }
              }
              
              // Add delay between batches to be nice to the RPC
              if (i + batchSize < faucetAddresses.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
            
          } catch (fallbackError: any) {
            console.warn(`Fallback method also failed for factory ${factoryAddress}:`, fallbackError.message);
            continue;
          }
        }

      } catch (factoryError) {
        console.error(`Error checking factory ${factoryAddress}:`, factoryError);
        continue;
      }
    }

    // Return results
    if (conflictingFaucets.length > 0) {
      console.log(`Found ${conflictingFaucets.length} name conflicts across factories`);
      return {
        exists: true,
        existingFaucet: {
          address: conflictingFaucets[0].address,
          name: conflictingFaucets[0].name,
          owner: conflictingFaucets[0].owner
        },
        conflictingFaucets
      };
    }

    console.log(`Name "${proposedName}" is available across all factories on current network`);
    return { exists: false };
    
  } catch (error: any) {
    console.error("Error in checkFaucetNameExistsAcrossAllFactories:", error);
    // Don't throw, return graceful degradation
    return { 
      exists: false, 
      warning: "Name validation unavailable due to network issues. Please ensure your name is unique."
    };
  }
}

/**
 * Enhanced version of the original checkFaucetNameExists that checks all factories
 * This replaces the single factory check with a multi-factory check
 */
export async function checkFaucetNameExists(
  provider: BrowserProvider,
  network: Network, // Pass the whole network object instead of single factory address
  proposedName: string
): Promise<NameValidationResult & { 
  conflictingFaucets?: Array<{
    address: string
    name: string
    owner: string
    factoryAddress: string
    factoryType: FactoryType
  }>
}> {
  try {
    if (!proposedName.trim()) {
      throw new Error("Faucet name cannot be empty");
    }

    console.log(`Checking name "${proposedName}" across all factories on ${network.name}`);
    
    // Use the new function that checks all factories
    return await checkFaucetNameExistsAcrossAllFactories(
      provider, 
      network.factoryAddresses, 
      proposedName
    );
    
  } catch (error: any) {
    console.error("Error in enhanced name check:", error);
    return { 
      exists: false, 
      warning: "Unable to validate name due to network issues. Please ensure your name is unique."
    };
  }
}

/**
 * Get all faucet names from all factories on a single network (for comparison/statistics)
 */
export async function getAllFaucetNamesOnNetwork(
  provider: BrowserProvider | JsonRpcProvider,
  network: Network
): Promise<Array<{
  faucetAddress: string
  name: string
  owner: string
  factoryAddress: string
  factoryType: FactoryType
}>> {
  try {
    console.log(`Fetching all faucet names from ${network.name}...`);
    
    const allFaucetNames: any[] = [];

    // Process all factory addresses for this network
    for (const factoryAddress of network.factoryAddresses) {
      if (!isAddress(factoryAddress)) {
        console.warn(`Invalid factory address ${factoryAddress} on ${network.name}, skipping`);
        continue;
      }

      // Check if factory contract exists
      const code = await provider.getCode(factoryAddress);
      if (code === "0x") {
        console.warn(`No contract at factory address ${factoryAddress} on ${network.name}`);
        continue;
      }

      // Detect factory type and get appropriate ABI
      let factoryType: FactoryType;
      let config: FactoryConfig;
      
      try {
        factoryType = await detectFactoryType(provider, factoryAddress);
        config = getFactoryConfig(factoryType);
        console.log(`Processing factory ${factoryAddress} (type: ${factoryType})`);
      } catch (error) {
        console.warn(`Could not detect factory type for ${factoryAddress}, skipping:`, error);
        continue;
      }

      const factoryContract = new Contract(factoryAddress, config.abi, provider);

      try {
        // Try to get all faucet details at once (more efficient)
        let faucetDetails: any[] = [];
        try {
          faucetDetails = await factoryContract.getAllFaucetDetails();
          console.log(`Got ${faucetDetails.length} faucet details from factory ${factoryAddress}`);
        } catch (getAllError: any) {
          console.warn(`getAllFaucetDetails failed for ${factoryAddress}, trying individual approach:`, getAllError.message);
          
          // Fallback: Get addresses and fetch names individually
          const faucetAddresses: string[] = await factoryContract.getAllFaucets();
          console.log(`Got ${faucetAddresses.length} faucet addresses from factory ${factoryAddress}`);
          
          // Process in batches to avoid overwhelming RPC
          const batchSize = 10;
          for (let i = 0; i < faucetAddresses.length; i += batchSize) {
            const batch = faucetAddresses.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (faucetAddress) => {
              try {
                if (!faucetAddress || faucetAddress === ZeroAddress) return null;
                
                const faucetType = factoryType as FaucetType;
                const faucetConfig = getFaucetConfig(faucetType);
                const faucetContract = new Contract(faucetAddress, faucetConfig.abi, provider);
                
                // Check if deleted
                const isDeleted = await faucetContract.deleted();
                if (isDeleted) return null;
                
                // Get basic details
                const [name, owner] = await Promise.all([
                  faucetContract.name(),
                  faucetContract.owner()
                ]);
                
                return {
                  faucetAddress,
                  name,
                  owner,
                  factoryAddress,
                  factoryType
                };
              } catch (error) {
                console.warn(`Error getting details for faucet ${faucetAddress}:`, error);
                return null;
              }
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            batchResults.forEach(result => {
              if (result.status === 'fulfilled' && result.value) {
                faucetDetails.push(result.value);
              }
            });
            
            // Add delay between batches
            if (i + batchSize < faucetAddresses.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }

        // Process the faucet details
        faucetDetails.forEach(detail => {
          if (detail && detail.faucetAddress && detail.name) {
            allFaucetNames.push({
              faucetAddress: detail.faucetAddress,
              name: detail.name,
              owner: detail.owner || "Unknown",
              factoryAddress,
              factoryType,
            });
          }
        });
        
      } catch (factoryError) {
        console.error(`Error fetching faucet names from factory ${factoryAddress} on ${network.name}:`, factoryError);
      }
    }
    
    console.log(`Found ${allFaucetNames.length} faucets total on ${network.name}`);
    return allFaucetNames;
    
  } catch (error) {
    console.error(`Error fetching faucet names for ${network.name}:`, error);
    return [];
  }
}

// Alternative: Enhanced createFaucet function that includes proper validation
// If you want to include validation in the createFaucet function, use this version instead:



/**
 * Utility function to safely make contract calls with fallbacks
 */
export async function safeContractCall<T>(
  contract: Contract,
  methodName: string,
  args: any[] = [],
  fallbackValue: T
): Promise<T> {
  try {
    const result = await contract[methodName](...args);
    return result;
  } catch (error: any) {
    console.warn(`Contract call ${methodName} failed:`, error.message);
    return fallbackValue;
  }
}

/**
 * Check if a contract method exists
 */
export async function checkContractMethod(
  contract: Contract,
  methodName: string
): Promise<boolean> {
  try {
    const fragment = contract.interface.getFunction(methodName);
    return fragment !== null;
  } catch {
    return false;
  }
}

export async function getAllAdmins(
  provider: BrowserProvider | JsonRpcProvider,
  faucetAddress: string,
  faucetType?: FaucetType
): Promise<string[]> {
  try {
    if (!isAddress(faucetAddress)) {
      throw new Error("Invalid faucet address");
    }

    // Detect faucet type if not provided
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)

    const faucetContract = new Contract(faucetAddress, config.abi, provider);
    const adminsResponse = await faucetContract.getAllAdmins();
    const admins = Array.isArray(adminsResponse)
      ? adminsResponse.flat().filter((admin: string) => isAddress(admin))
      : [];
    console.log(`Fetched admins for faucet ${faucetAddress}:`, admins);
    return admins;
  }  catch (error: any) {
    console.error(`Error fetching admins for ${faucetAddress}:`, error);
    throw new Error(error.message || "Failed to fetch admins");
  }
}

export async function isAdmin(
  provider: BrowserProvider | JsonRpcProvider,
  faucetAddress: string,
  userAddress: string,
  faucetType?: FaucetType
): Promise<boolean> {
  try {
    if (!isAddress(faucetAddress) || !isAddress(userAddress)) {
      throw new Error("Invalid faucet or user address");
    }

    const admins = await getAllAdmins(provider, faucetAddress, faucetType);
    const isAdminStatus = admins.some((admin: string) => admin.toLowerCase() === userAddress.toLowerCase());
    console.log(`Admin check for ${userAddress} on faucet ${faucetAddress}: ${isAdminStatus}`);
    return isAdminStatus;
  } catch (error: any) {
    console.error(`Error checking admin status for ${userAddress} on ${faucetAddress}:`, error);
    return false;
  }
}

// Check if an address is whitelisted for a faucet (only for droplist faucets)
export async function isWhitelisted(
  provider: BrowserProvider | JsonRpcProvider,
  faucetAddress: string,
  userAddress: string,
  faucetType?: FaucetType
): Promise<boolean> {
  try {
    if (!isAddress(faucetAddress) || !isAddress(userAddress)) {
      throw new Error("Invalid faucet or user address")
    }

    // Detect faucet type if not provided
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    
    // Only droplist faucets have whitelist functionality
    if (detectedFaucetType !== 'droplist') {
      console.log(`Faucet ${faucetAddress} is not a droplist faucet, returning false for whitelist check`)
      return false
    }

    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, provider)
    const isWhitelisted = await faucetContract.isWhitelisted(userAddress)
    console.log(`Whitelist check for ${userAddress} on faucet ${faucetAddress}: ${isWhitelisted}`)
    return isWhitelisted
  } catch (error: any) {
    console.error(`Error checking whitelist for ${userAddress} on ${faucetAddress}:`, error)
    return false
  }
}

// Get faucet backend mode from contract
export async function getFaucetBackendMode(
  provider: BrowserProvider | JsonRpcProvider,
  faucetAddress: string,
  faucetType?: FaucetType
): Promise<boolean> {
  try {
    if (!isAddress(faucetAddress)) {
      throw new Error("Invalid faucet address");
    }

    // Detect faucet type if not provided
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)

    const faucetContract = new Contract(faucetAddress, config.abi, provider);
    const useBackend = await faucetContract.getUseBackend();
    console.log(`Backend mode for faucet ${faucetAddress}: ${useBackend}`);
    return useBackend;
  } catch (error: any) {
    console.error(`Error fetching backend mode for ${faucetAddress}:`, error);
    return false; // Default to false if contract call fails
  }
}

// Get faucet details with admin check and backend mode from contract
export async function getFaucetDetails(
  provider: BrowserProvider | JsonRpcProvider, 
  faucetAddress: string,
  faucetType?: FaucetType
) {
  try {
    console.log(`Getting details for faucet ${faucetAddress}`);
    
    // Detect faucet type if not provided
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    
    let contract: Contract;
    if ("getSigner" in provider && typeof provider.getSigner === "function") {
      try {
        contract = new Contract(faucetAddress, config.abi, await provider.getSigner());
      } catch (error) {
        console.warn(`Error getting signer, falling back to provider for ${faucetAddress}:`, error);
        contract = new Contract(faucetAddress, config.abi, provider);
      }
    } else {
      contract = new Contract(faucetAddress, config.abi, provider);
    }

    let tokenAddress = ZeroAddress;
    let ownerAddress = ZeroAddress;
    let faucetName = "Unknown Faucet";
    let claimAmount = BigInt(0);
    let startTime = BigInt(0);
    let endTime = BigInt(0);
    let isClaimActive = false;
    let balance = BigInt(0);
    let isEther = true;
    let tokenSymbol = "CELO";
    let tokenDecimals = 18;
    let useBackend = false;

    try {
      tokenAddress = await contract.token();
    } catch (error) {
      console.warn(`Error getting token address:`, error);
    }
    try {
      ownerAddress = await contract.owner();
    } catch (error) {
      console.warn(`Error getting owner address:`, error);
    }
    try {
      faucetName = await contract.name();
    } catch (error) {
      console.warn(`Error getting name:`, error);
    }
    try {
      // Handle different claim amount access patterns
      if (detectedFaucetType === 'custom') {
        // Custom faucets don't have a fixed claimAmount, will be handled per user
        claimAmount = BigInt(0);
      } else {
        claimAmount = await contract.claimAmount();
      }
    } catch (error) {
      console.warn(`Error getting claim amount:`, error);
    }
    try {
      startTime = await contract.startTime();
    } catch (error) {
      console.warn(`Error getting start time:`, error);
    }
    try {
      endTime = await contract.endTime();
    } catch (error) {
      console.warn(`Error getting end time:`, error);
    }
    try {
      isClaimActive = await contract.isClaimActive();
    } catch (error) {
      console.warn(`Error getting claim active status:`, error);
    }
    try {
      useBackend = await contract.getUseBackend();
    } catch (error) {
      console.warn(`Error getting backend mode:`, error);
    }
    try {
      const balanceResult = await contract.getFaucetBalance();
      balance = balanceResult[0];
      isEther = balanceResult[1];
      const network = await provider.getNetwork();
      tokenSymbol = isEther
        ? isCeloNetwork(network.chainId)
          ? "CELO"
          : network.chainId === BigInt(1135)
            ? "LISK"
            : network.chainId === BigInt(8453) || network.chainId === BigInt(84532)
              ? "ETH"
              : "ETH"
        : tokenSymbol;
    } catch (error) {
      console.warn(`Error getting balance:`, error);
      if (tokenAddress !== ZeroAddress) {
        try {
          const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
          balance = await tokenContract.balanceOf(faucetAddress);
          isEther = false;
        } catch (innerError) {
          console.warn(`Error getting token balance:`, innerError);
        }
      } else {
        try {
          balance = await provider.getBalance(faucetAddress);
          isEther = true;
        } catch (innerError) {
          console.warn(`Error getting native balance:`, innerError);
        }
      }
    }

    if (!isEther && tokenAddress !== ZeroAddress) {
      try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
        tokenSymbol = await tokenContract.symbol();
      } catch (error) {
        console.warn(`Error getting token symbol:`, error);
      }
      try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
        tokenDecimals = await tokenContract.decimals();
      } catch (error) {
        console.warn(`Error getting token decimals:`, error);
      }
    }

    let hasClaimed = false;
    let isUserAdmin = false;
    if ("getSigner" in provider && typeof provider.getSigner === "function") {
      try {
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();
        hasClaimed = await contract.hasClaimed(userAddress);
        isUserAdmin = await isAdmin(provider, faucetAddress, userAddress, detectedFaucetType);
      } catch (error) {
        console.warn(`Error checking claim status or admin status:`, error);
      }
    }

    console.log(`Successfully got details for faucet ${faucetAddress}`);
    return {
      faucetAddress,
      token: tokenAddress,
      owner: ownerAddress,
      name: faucetName,
      claimAmount,
      startTime,
      endTime,
      isClaimActive,
      balance,
      isEther,
      tokenSymbol,
      tokenDecimals,
      hasClaimed,
      isUserAdmin,
      backendMode: useBackend,
      faucetType: detectedFaucetType, // Include detected faucet type
    };
  } catch (error) {
    console.error(`Error getting faucet details for ${faucetAddress}:`, error);
    return {
      faucetAddress,
      token: ZeroAddress,
      owner: ZeroAddress,
      name: "Error Loading Faucet",
      claimAmount: BigInt(0),
      startTime: BigInt(0),
      endTime: BigInt(0),
      isClaimActive: false,
      balance: BigInt(0),
      isEther: true,
      tokenSymbol: "CELO",
      tokenDecimals: 18,
      hasClaimed: false,
      isUserAdmin: false,
      backendMode: false,
      faucetType: 'dropcode' as FaucetType, // Default type
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
export const getUserFaucets = async (userAddress: string) => {
  try {
    const response = await fetch(`https://fauctdrop-backend.onrender.com/user-faucets/${userAddress}`);
    
    if (!response.ok) {
        if(response.status === 404) return []; 
        throw new Error("Failed to fetch user faucets");
    }

    const data = await response.json();
    return data.faucets || []; 
  } catch (error) {
    console.error("Error fetching user faucets:", error);
    return [];
  }
};
// New helper function to fetch the blacklist
async function getDeletedFaucets(chainId: number): Promise<Set<string>> {
    try {
        // Adjust endpoint if necessary (e.g. /deleted-faucets or similar)
        const response = await fetch(`https://fauctdrop-backend.onrender.com/deleted-faucets?chainId=${chainId}`);
        
        if (!response.ok) {
            console.warn("Failed to fetch deleted faucets list");
            return new Set();
        }

        const data = await response.json();
        // Assuming backend returns { deletedAddresses: string[] } or just string[]
        // We use a Set for O(1) lookup performance during filtering
        const addresses = Array.isArray(data) ? data : (data.deletedAddresses || []);
        return new Set(addresses.map((a: string) => a.toLowerCase()));
    } catch (error) {
        console.error("Error fetching deleted faucets:", error);
        return new Set(); // Fail safe: return empty set so UI still loads
    }
}

export async function getFaucetsForNetwork(
    network: Network,
    provider: JsonRpcProvider
): Promise<FaucetMeta[]> {
    try {
        // 1. Start fetching the blacklist immediately (Non-blocking)
        // We assume network.chainId exists; if strictly typed, ensure it's available
        const deletedFaucetsPromise = getDeletedFaucets(Number(network.chainId));

        // 2. Start fetching faucets from all factory addresses in parallel (Existing logic)
        const resultsPromises = network.factoryAddresses.map(async (factoryAddress) => {
            if (!isAddress(factoryAddress)) return [];
            
            try {
                const factoryType = await detectFactoryType(provider, factoryAddress);
                const config = getFactoryConfig(factoryType);
                const factoryContract = new Contract(factoryAddress, config.abi, provider);
                const factoryCode = await provider.getCode(factoryAddress);
                if (factoryCode === "0x") return [];
                
                // Fetch all faucet addresses
                const faucetAddresses: string[] = await factoryContract.getAllFaucets();
                
                // Fetch details in parallel
                const metaPromises = faucetAddresses.map(async (addr) => {
                    if (!addr || addr === ZeroAddress) return null;
                    
                    const details = await getFaucetDetails(provider, addr, factoryType as FaucetType);
                    
                    return {
                        faucetAddress: details.faucetAddress,
                        isClaimActive: details.isClaimActive,
                        isEther: details.isEther,
                        createdAt: BigInt(details.startTime).toString(), 
                        tokenSymbol: details.tokenSymbol,
                        name: details.name,
                        owner: details.owner,
                        factoryAddress: factoryAddress,
                    } as FaucetMeta;
                });
                
                // Filter out nulls
                return (await Promise.all(metaPromises)).filter(m => m !== null) as FaucetMeta[];
            } catch (error) {
                console.error(`Error during lightweight fetch for factory ${factoryAddress}:`, error);
                return [];
            }
        });

        // 3. Await BOTH the blacklist and the blockchain results
        const [deletedFaucetsSet, allResults] = await Promise.all([
            deletedFaucetsPromise,
            Promise.all(resultsPromises)
        ]);

        let allFaucetsMeta = allResults.flat();
        
        // 4. Remove duplicates
        const uniqueFaucets = allFaucetsMeta.filter((faucet, index, self) =>
            index === self.findIndex((t) => (
                t.faucetAddress === faucet.faucetAddress
            ))
        );

        // 5. Final Filter: Remove faucets that are in the deleted set
        // We check against the Set we created in step 1
        const activeFaucets = uniqueFaucets.filter(faucet => 
            !deletedFaucetsSet.has(faucet.faucetAddress.toLowerCase())
        );

        return activeFaucets;

    } catch (error) {
        console.error(`Error in getFaucetsForNetwork (lightweight aggregation):`, error);
        return [];
    }
}

// Fetch transaction history for a specific faucet (admin only)
export async function getFaucetTransactionHistory(
  provider: BrowserProvider,
  faucetAddress: string,
  network: Network,
  faucetType?: FaucetType
): Promise<{
  faucetAddress: string
  transactionType: string
  initiator: string
  amount: bigint
  isEther: boolean
  timestamp: number
}[]> {
  try {
    if (!isAddress(faucetAddress)) {
      throw new Error(`Invalid faucet address: ${faucetAddress}`)
    }

    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()
    const permissions = await checkPermissions(provider, faucetAddress, signerAddress, faucetType)

    if (!permissions.isOwner && !permissions.isAdmin) {
      throw new Error("Only the owner or admin can view transaction history")
    }

    let transactions: any[] = [];

    // Iterate through all factory addresses to collect transactions
    for (const factoryAddress of network.factoryAddresses) {
      if (!isAddress(factoryAddress)) {
        console.warn(`Invalid factory address ${factoryAddress} on ${network.name}, skipping`);
        continue;
      }

      // Detect factory type and get appropriate ABI
      let factoryType: FactoryType;
      let config: FactoryConfig;
      
      try {
        factoryType = await detectFactoryType(provider, factoryAddress);
        config = getFactoryConfig(factoryType);
      } catch (error) {
        console.warn(`Could not detect factory type for ${factoryAddress}, skipping:`, error);
        continue;
      }

      const factoryContract = new Contract(factoryAddress, config.abi, provider);

      // Check if factory contract exists
      const code = await provider.getCode(factoryAddress);
      if (code === "0x") {
        console.warn(`No contract at factory address ${factoryAddress} on ${network.name}`);
        continue;
      }

      // Use getFaucetTransactions from the appropriate ABI
      try {
        const factoryTxs = await factoryContract.getFaucetTransactions(faucetAddress);
        transactions.push(...factoryTxs);
      } catch (error) {
        console.warn(`Error fetching transactions from factory ${factoryAddress}:`, error);
      }
    }

    // Map and filter transactions
    const filteredTransactions = transactions
      .filter((tx: any) => tx.faucetAddress.toLowerCase() === faucetAddress.toLowerCase())
      .map((tx: any) => ({
        faucetAddress: tx.faucetAddress as string,
        transactionType: tx.transactionType as string,
        initiator: tx.initiator as string,
        amount: BigInt(tx.amount),
        isEther: tx.isEther as boolean,
        timestamp: Number(tx.timestamp),
      }));

    console.log(`Fetched ${filteredTransactions.length} transactions for faucet ${faucetAddress}`)
    return filteredTransactions
  } catch (error: any) {
    console.error(`Error fetching transaction history for faucet ${faucetAddress}:`, error)
    throw new Error(error.message || "Failed to fetch transaction history")
  }
}

async function contractExists(provider: JsonRpcProvider, address: string): Promise<boolean> {
  try {
    const code = await provider.getCode(address)
    return code !== "0x"
  } catch (error) {
    console.warn(`Error checking contract at ${address}:`, error)
    return false
  }
}

export async function getAllClaims(
  chainId: bigint,
  networks: Network[],
): Promise<
  {
    claimer: string
    faucet: string
    amount: bigint
    txHash: `0x${string}`
    networkName: string
    timestamp: number
    tokenSymbol: string
    tokenDecimals: number
    isEther: boolean
  }[]
> {
  try {
    const network = networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw new Error(`Network with chainId ${chainId} not found`)
    }

    const provider = new JsonRpcProvider(network.rpcUrl)
    const storageAddress = STORAGE_CONTRACT_ADDRESS
    const contract = new Contract(storageAddress, STORAGE_ABI, provider)

    // Verify contract exists
    const exists = await contractExists(provider, storageAddress)
    if (!exists) {
      console.error(`No contract at ${storageAddress} on ${network.name}`)
      return []
    }

    // Call getAllClaims function
    const claims: any[] = await contract.getAllClaims()

    // Fetch token details for each claim
    const formattedClaims = await Promise.all(
      claims.map(async (claim: any) => {
        let tokenSymbol = NATIVE_TOKEN_MAP[network.name] || "TOK"
        let tokenDecimals = 18
        let isEther = true

        // Check cache for faucet details
        const cacheKey = `${network.chainId}-${claim.faucet}`
        let faucetDetails = faucetDetailsCache.get(cacheKey)

        if (!faucetDetails) {
          try {
            faucetDetails = await getFaucetDetails(provider, claim.faucet)
            faucetDetailsCache.set(cacheKey, faucetDetails)
          } catch (error) {
            console.warn(`Error fetching faucet details for ${claim.faucet} on ${network.name}:`, error)
            faucetDetails = {
              tokenSymbol: NATIVE_TOKEN_MAP[network.name] || "TOK",
              tokenDecimals: 18,
              isEther: true,
            }
          }
        }

        tokenSymbol = faucetDetails.tokenSymbol
        tokenDecimals = faucetDetails.tokenDecimals
        isEther = faucetDetails.isEther

        return {
          claimer: claim.claimer as string,
          faucet: claim.faucet as string,
          amount: BigInt(claim.amount),
          txHash: claim.txHash as `0x${string}`,
          networkName: claim.networkName as string,
          timestamp: Number(claim.timestamp),
          tokenSymbol,
          tokenDecimals,
          isEther,
        }
      }),
    )

    return formattedClaims
  } catch (error) {
    console.error(`Error fetching claims for chainId ${chainId}:`, error)
    if (error instanceof Error) {
      throw new Error(`Failed to fetch claims: ${error.message}`)
    }
    throw new Error("Failed to fetch claims: Unknown error")
  }
}

export async function getAllClaimsFromFactoryTransactions(
  networks: Network[]
): Promise<
  {
    claimer: string
    faucet: string
    amount: bigint
    txHash: `0x${string}`
    networkName: string
    timestamp: number
    chainId: bigint
    tokenSymbol: string
    tokenDecimals: number
    isEther: boolean
  }[]
> {
  try {
    const allClaims: any[] = []

    for (const network of networks) {
      try {
        const provider = new JsonRpcProvider(network.rpcUrl)
        
        // Iterate through all factory addresses for this network
        for (const factoryAddress of network.factoryAddresses) {
          if (!isAddress(factoryAddress)) {
            console.warn(`Invalid factory address ${factoryAddress} on ${network.name}, skipping`)
            continue
          }

          // Check if factory contract exists
          const code = await provider.getCode(factoryAddress)
          if (code === "0x") {
            console.warn(`No contract at factory address ${factoryAddress} on ${network.name}`)
            continue
          }

          // Detect factory type and get appropriate ABI
          let factoryType: FactoryType;
          let config: FactoryConfig;
          
          try {
            factoryType = await detectFactoryType(provider, factoryAddress);
            config = getFactoryConfig(factoryType);
          } catch (error) {
            console.warn(`Could not detect factory type for ${factoryAddress}, skipping:`, error);
            continue;
          }

          const factoryContract = new Contract(factoryAddress, config.abi, provider)

          try {
            // Get all transactions from this factory
            const allTransactions = await factoryContract.getAllTransactions()
            console.log(`Found ${allTransactions.length} transactions from factory ${factoryAddress} on ${network.name}`)

            // Filter for claim transactions (assuming transaction type includes "claim" or similar)
            const claimTransactions = allTransactions.filter((tx: any) => 
              tx.transactionType && 
              (tx.transactionType.toLowerCase().includes('claim') || 
               tx.transactionType.toLowerCase().includes('drop'))
            )

            console.log(`Found ${claimTransactions.length} claim transactions from factory ${factoryAddress}`)

            // Process each claim transaction
            for (const tx of claimTransactions) {
              try {
                // Get faucet details to fetch token information
                let tokenSymbol = NATIVE_TOKEN_MAP[network.name] || "TOK"
                let tokenDecimals = 18
                let isEther = true

                // Check cache for faucet details
                const cacheKey = `${network.chainId}-${tx.faucetAddress}`
                let faucetDetails = faucetDetailsCache.get(cacheKey)

                if (!faucetDetails) {
                  try {
                    faucetDetails = await getFaucetDetails(provider, tx.faucetAddress)
                    faucetDetailsCache.set(cacheKey, faucetDetails)
                  } catch (error) {
                    console.warn(`Error fetching faucet details for ${tx.faucetAddress} on ${network.name}:`, error)
                    faucetDetails = {
                      tokenSymbol: NATIVE_TOKEN_MAP[network.name] || "TOK",
                      tokenDecimals: 18,
                      isEther: true,
                    }
                  }
                }

                tokenSymbol = faucetDetails.tokenSymbol
                tokenDecimals = faucetDetails.tokenDecimals
                isEther = faucetDetails.isEther

                // Create claim object from transaction data
                const claim = {
                  claimer: tx.initiator as string, // Assuming initiator is the claimer for claim transactions
                  faucet: tx.faucetAddress as string,
                  amount: BigInt(tx.amount),
                  txHash: tx.txHash as `0x${string}`, // Assuming txHash exists in transaction data
                  networkName: network.name,
                  timestamp: Number(tx.timestamp),
                  chainId: network.chainId,
                  tokenSymbol,
                  tokenDecimals,
                  isEther,
                }

                allClaims.push(claim)
              } catch (processingError) {
                console.warn(`Error processing claim transaction:`, processingError)
              }
            }
          } catch (factoryError) {
            console.error(`Error fetching transactions from factory ${factoryAddress} on ${network.name}:`, factoryError)
          }
        }
      } catch (networkError) {
        console.error(`Error processing network ${network.name}:`, networkError)
      }
    }

    return allClaims
  } catch (error) {
    console.error("Error fetching claims from factory transactions:", error)
    return []
  }
}

// Modified function to combine storage data with factory transaction data
export async function getAllClaimsForAllNetworks(networks: Network[]): Promise<
  {
    claimer: string
    faucet: string
    amount: bigint
    txHash: `0x${string}`
    networkName: string
    timestamp: number
    chainId: bigint
    tokenSymbol: string
    tokenDecimals: number
    isEther: boolean
  }[]
> {
  try {
    console.log("Fetching claims from both storage and factory transactions...")
    
    // Fetch claims from storage contract (historical data)
    const storageClaims = await fetchStorageData()
    console.log(`Found ${storageClaims.length} claims from storage contract`)

    // Add chainId to storage claims (assuming they're all from Celo for now)
    const storageClaimsWithChainId = storageClaims.map(claim => ({
      ...claim,
      chainId: BigInt(42220), // Celo chainId - adjust if storage is on different network
    }))

    // Fetch claims from factory transactions (new method)
    const factoryClaims = await getAllClaimsFromFactoryTransactions(networks)
    console.log(`Found ${factoryClaims.length} claims from factory transactions`)

    // Combine both sources and remove duplicates based on txHash
    const allClaims = [...storageClaimsWithChainId, ...factoryClaims]
    
    // Remove duplicates based on txHash
    const uniqueClaims = allClaims.reduce((acc, current) => {
      const existing = acc.find(item => item.txHash === current.txHash)
      if (!existing) {
        acc.push(current)
      }
      return acc
    }, [] as typeof allClaims)

    // Sort by timestamp (most recent first)
    const sortedClaims = uniqueClaims.sort((a, b) => b.timestamp - a.timestamp)
    
    console.log(`Total unique claims: ${sortedClaims.length} (${storageClaims.length} from storage + ${factoryClaims.length} from factory - duplicates)`)
    
    return sortedClaims
  } catch (error) {
    console.error("Error fetching claims for all networks:", error)
    if (error instanceof Error) {
      throw new Error(`Failed to fetch claims for all networks: ${error.message}`)
    }
    throw new Error("Failed to fetch claims for all networks: Unknown error")
  }
}

// Optional: Add a function to get only new claims from factories (excluding storage)
export async function getNewClaimsFromFactories(networks: Network[]): Promise<
  {
    claimer: string
    faucet: string
    amount: bigint
    txHash: `0x${string}`
    networkName: string
    timestamp: number
    chainId: bigint
    tokenSymbol: string
    tokenDecimals: number
    isEther: boolean
  }[]
> {
  try {
    const factoryClaims = await getAllClaimsFromFactoryTransactions(networks)
    const sortedClaims = factoryClaims.sort((a, b) => b.timestamp - a.timestamp)
    
    console.log(`Found ${sortedClaims.length} new claims from factory transactions`)
    return sortedClaims
  } catch (error) {
    console.error("Error fetching new claims from factories:", error)
    return []
  }
}

// Helper function to migrate storage claims to factory format if needed
export async function migrateStorageClaimsToFactory(): Promise<void> {
  try {
    console.log("Starting migration of storage claims...")
    
    // This would be implemented if you want to migrate old storage claims
    // to be tracked through factory transactions as well
    // Implementation depends on your specific migration strategy
    
    console.log("Migration completed")
  } catch (error) {
    console.error("Error during migration:", error)
  }
}

// Fund faucet


export async function retrieveSecretCode(faucetAddress: string): Promise<string> {
  if (!isAddress(faucetAddress)) {
    throw new Error(`Invalid faucet address: ${faucetAddress}`)
  }

  try {
    // Check localStorage first
    const cachedCode = getFromStorage(`secretCode_${faucetAddress}`)
    if (cachedCode && /^[A-Z0-9]{6}$/.test(cachedCode)) {
      console.log(`Retrieved Drop code for ${faucetAddress} from localStorage`)
      return cachedCode
    }

    // Fallback to backend if not found in localStorage
    const response = await fetch("https://fauctdrop-backend.onrender.com/retrieve-secret-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        faucetAddress: getAddress(faucetAddress), // Normalize address
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || "Failed to retrieve Drop code")
    }

    const result = await response.json()
    const secretCode = result.secretCode

    if (!secretCode || !/^[A-Z0-9]{6}$/.test(secretCode)) {
      throw new Error("Invalid Drop code format received from backend")
    }

    // Store the retrieved Drop code in localStorage for future use
    saveToStorage(`secretCode_${faucetAddress}`, secretCode)

    console.log(`Retrieved and stored Drop code for ${faucetAddress} from backend`)
    return secretCode
  } catch (error: any) {
    console.error("Error retrieving Drop code:", error)
    throw new Error(error.message || "Failed to retrieve Drop code")
  }
}

const ERROR_SIGNATURES = {
  OwnableUnauthorizedAccount: "0x118cdaa7", // keccak256("OwnableUnauthorizedAccount(address)")
  ContractPaused: "0xbec6425c", // keccak256("ContractPaused()")
  OnlyAdmin: "0x9b23d3d9", // keccak256("OnlyAdmin()")
  EmptyName: "0xe8930e56", // keccak256("EmptyName()")
  UnknownError: "0xab35696f", // Placeholder for new error
  NotWhitelisted: "0x55f33f14", // keccak256("NotWhitelisted()")
}

// Helper to decode revert data
function decodeRevertError(data: string): string {
  if (data.startsWith(ERROR_SIGNATURES.OwnableUnauthorizedAccount)) {
    return "Only the faucet owner can perform this action"
  } else if (data.startsWith(ERROR_SIGNATURES.ContractPaused)) {
    return "Faucet is paused and cannot be modified"
  } else if (data.startsWith(ERROR_SIGNATURES.OnlyAdmin)) {
    return "Only an admin can perform this action"
  } else if (data.startsWith(ERROR_SIGNATURES.EmptyName)) {
    return "Faucet name cannot be empty"
  } else if (data.startsWith(ERROR_SIGNATURES.NotWhitelisted)) {
    return "Only whitelisted addresses are supported"
  } else if (data.startsWith(ERROR_SIGNATURES.UnknownError)) {
    return "Permission denied or invalid state (verify contract ABI and state)"
  }
  return "Unknown contract error occurred"
}

export async function createFaucetWithValidation(
  provider: BrowserProvider,
  factoryAddress: string,
  name: string,
  tokenAddress: string,
  chainId: bigint,
  networkId: bigint,
  useBackend: boolean,
  isCustom: boolean = false,
  network: Network,
): Promise<string> {
  try {
    if (!name.trim()) throw new Error("Faucet name cannot be empty");
    const factoryType = determineFactoryType(useBackend, isCustom)
    const config = getFactoryConfig(factoryType)
    
    // ... (Validation logic remains same) ...
    try {
      const nameCheck = await checkFaucetNameExists(provider, network, name);
      if (nameCheck.exists && nameCheck.existingFaucet) throw new Error(`Faucet name exists.`);
    } catch (e: any) { if (e.message.includes("exists")) throw e; }

    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const data = new Contract(factoryAddress, config.abi, signer).interface.encodeFunctionData(config.createFunction, [name, tokenAddress, VALID_BACKEND_ADDRESS]);
    const dataWithReferral = appendDivviReferralData(data);
    const feeData = await provider.getFeeData();
    
    const gasLimit = await estimateGasWithFallback(provider, {
      to: factoryAddress, data: dataWithReferral, from: signerAddress, value: BigInt(0)
    }, BigInt(1500000));

    const tx = await signer.sendTransaction({
      to: factoryAddress, data: dataWithReferral, gasLimit, 
      maxFeePerGas: feeData.maxFeePerGas || undefined, 
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined
    });

    // 💡 UPDATED: Safe wait
    const receipt = await safeWaitForReceipt(tx, provider);
    if (!receipt) throw new Error("Transaction receipt is null");
    
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));

    const factoryInterface = new Interface(config.abi);
    const event = receipt?.logs?.map((log: any) => {
        try { return factoryInterface.parseLog({ data: log.data, topics: log.topics as string[] }); } catch { return null; }
      }).find((parsed: any) => parsed?.name === "FaucetCreated");

    if (!event || !event.args?.faucet) throw new Error("Failed to retrieve address");
    return event.args.faucet as string;
  } catch (error: any) {
    if (error.message?.includes("network changed")) throw new Error("Network changed during transaction.");
    throw new Error(error.reason || error.message || "Failed to create faucet");
  }
}

async function deleteFaucetMetadata(faucetAddress: string, userAddress: string, chainId: number): Promise<void> {
    try {
        const response = await fetch("https://fauctdrop-backend.onrender.com/delete-faucet-metadata", { // Replace with your actual backend URL
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                faucetAddress,
                userAddress,
                chainId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.warn(`Failed to delete metadata from backend: ${errorData.detail || 'Unknown error'}`);
        } else {
            console.log(`✅ Faucet metadata successfully removed from backend for ${faucetAddress}`);
        }
    } catch (error) {
        console.error(`Error communicating with backend for metadata deletion:`, error);
    }
}

export async function createFaucet(
  provider: BrowserProvider,
  factoryAddress: string,
  name: string,
  tokenAddress: string,
  chainId: bigint,
  networkId: bigint,
  useBackend: boolean,
  isCustom: boolean = false,
): Promise<string> {
  try {
    const factoryType = determineFactoryType(useBackend, isCustom)
    const config = getFactoryConfig(factoryType)
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const data = new Contract(factoryAddress, config.abi, signer).interface.encodeFunctionData(config.createFunction, [name, tokenAddress, VALID_BACKEND_ADDRESS]);
    const dataWithReferral = appendDivviReferralData(data);

    const gasLimit = await estimateGasWithFallback(provider, {
      to: factoryAddress, data: dataWithReferral, from: signerAddress, value: BigInt(0)
    }, BigInt(1500000));

    const tx = await signer.sendTransaction({ to: factoryAddress, data: dataWithReferral, gasLimit });
    
    // 💡 UPDATED: Safe wait
    const receipt = await safeWaitForReceipt(tx, provider);
    if (!receipt) throw new Error("Transaction receipt is null");
    
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));

    const factoryInterface = new Interface(config.abi);
    const event = receipt?.logs?.map((log: any) => {
        try { return factoryInterface.parseLog({ data: log.data, topics: log.topics as string[] }); } catch { return null; }
      }).find((parsed: any) => parsed?.name === "FaucetCreated");

    if (!event || !event.args?.faucet) throw new Error("Failed to retrieve address");
    return event.args.faucet as string;
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to create faucet");
  }
}
export async function fundFaucet(
  provider: BrowserProvider,
  faucetAddress: string,
  amount: bigint,
  isEther: boolean,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) throw new Error("Switch to the network to perform operation")
  
  try {
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer)
    const isCelo = isCeloNetwork(chainId)
    
    const getGasParams = async () => {
      try { const feeData = await provider.getFeeData(); return feeData.maxFeePerGas ? { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas } : { gasPrice: feeData.gasPrice } } catch { return {} }
    }
    
    if (isEther && !isCelo) {
      const gasParams = await getGasParams()
      const gasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, value: amount, data: "0x" }, BigInt(100000));
      const tx = await signer.sendTransaction({ to: faucetAddress, value: amount, data: "0x", gasLimit, ...gasParams })
      
      // 💡 UPDATED: Safe wait
      await safeWaitForReceipt(tx, provider);
      await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))
      return tx.hash
    }
    
    const tokenAddress = isEther && isCelo ? "0x471EcE3750Da237f93B8E339c536989b8978a438" : await faucetContract.token()
    if (tokenAddress === ZeroAddress) throw new Error("Token address is zero")
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)
    const currentAllowance = await tokenContract.allowance(signerAddress, faucetAddress)
    
    if (currentAllowance < amount) {
      const gasParams = await getGasParams()
      
      if (currentAllowance > 0n) {
        const resetData = tokenContract.interface.encodeFunctionData("approve", [faucetAddress, 0n])
        const resetGasLimit = await estimateGasWithFallback(provider, { to: tokenAddress, from: signerAddress, data: resetData }, BigInt(100000));
        const resetTx = await signer.sendTransaction({ to: tokenAddress, data: resetData, gasLimit: resetGasLimit, ...gasParams })
        await safeWaitForReceipt(resetTx, provider);
      }
      
      const approveData = tokenContract.interface.encodeFunctionData("approve", [faucetAddress, amount])
      const approveDataWithReferral = appendDivviReferralData(approveData)
      const approveGasLimit = await estimateGasWithFallback(provider, { to: tokenAddress, from: signerAddress, data: approveDataWithReferral }, BigInt(200000));
      const approveTx = await signer.sendTransaction({ to: tokenAddress, data: approveDataWithReferral, gasLimit: approveGasLimit, ...gasParams })
      
      // 💡 UPDATED: Safe wait
      await safeWaitForReceipt(approveTx, provider);
      await reportTransactionToDivvi(approveTx.hash as `0x${string}`, Number(chainId))
    }
    
    const fundData = faucetContract.interface.encodeFunctionData("fund", [amount])
    const fundDataWithReferral = appendDivviReferralData(fundData)
    const gasParams = await getGasParams()
    const fundGasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, data: fundDataWithReferral, value: BigInt(0) }, BigInt(300000));
    
    const fundTx = await signer.sendTransaction({ to: faucetAddress, data: fundDataWithReferral, gasLimit: fundGasLimit, ...gasParams })
    
    // 💡 UPDATED: Safe wait
    await safeWaitForReceipt(fundTx, provider);
    await reportTransactionToDivvi(fundTx.hash as `0x${string}`, Number(chainId))
    return fundTx.hash
    
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to fund faucet")
  }
}

export async function withdrawTokens(
  provider: BrowserProvider,
  faucetAddress: string,
  amount: bigint,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) throw new Error("Switch to the network to perform operation")
  try {
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress();
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const data = new Contract(faucetAddress, config.abi, signer).interface.encodeFunctionData("withdraw", [amount])
    const dataWithReferral = appendDivviReferralData(data)
    const gasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, data: dataWithReferral, value: BigInt(0) }, BigInt(300000));

    const tx = await signer.sendTransaction({ to: faucetAddress, data: dataWithReferral, gasLimit })
    
    // 💡 UPDATED: Safe wait
    await safeWaitForReceipt(tx, provider);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))
    return tx.hash
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to withdraw tokens")
  }
}
export async function setWhitelistBatch(
  provider: BrowserProvider,
  faucetAddress: string,
  addresses: string[],
  status: boolean,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) throw new Error("Switch to the network to perform operation")
  try {
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    if (detectedFaucetType !== 'droplist') throw new Error("Whitelist only for droplist faucets")
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress();
    const config = getFaucetConfig(detectedFaucetType)
    const data = new Contract(faucetAddress, config.abi, signer).interface.encodeFunctionData("setWhitelistBatch", [addresses, status])
    const dataWithReferral = appendDivviReferralData(data)
    const gasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, data: dataWithReferral, value: BigInt(0) }, BigInt(5000000));

    const tx = await signer.sendTransaction({ to: faucetAddress, data: dataWithReferral, gasLimit })
    
    // 💡 UPDATED: Safe wait
    await safeWaitForReceipt(tx, provider);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))
    return tx.hash
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to set whitelist batch")
  }
}

export async function setCustomClaimAmountsBatch(
  provider: BrowserProvider,
  faucetAddress: string,
  users: string[],
  amounts: bigint[],
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) throw new Error("Switch to the network to perform operation")
  try {
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    if (detectedFaucetType !== 'custom') throw new Error("Only for custom faucets")
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress();
    const config = getFaucetConfig(detectedFaucetType)
    const data = new Contract(faucetAddress, config.abi, signer).interface.encodeFunctionData("setCustomClaimAmountsBatch", [users, amounts])
    const dataWithReferral = appendDivviReferralData(data)
    const gasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, data: dataWithReferral, value: BigInt(0) }, BigInt(5000000));

    const tx = await signer.sendTransaction({ to: faucetAddress, data: dataWithReferral, gasLimit })
    
    // 💡 UPDATED: Safe wait
    await safeWaitForReceipt(tx, provider);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))
    return tx.hash
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to set custom amounts")
  }
}

export async function resetAllClaims(
  provider: BrowserProvider,
  faucetAddress: string,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) throw new Error("Switch to the network to perform operation");
  try {
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const data = new Contract(faucetAddress, config.abi, signer).interface.encodeFunctionData("resetAllClaimed", []);
    const dataWithReferral = appendDivviReferralData(data);
    const gasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, data: dataWithReferral, value: BigInt(0) }, BigInt(1000000));

    const tx = await signer.sendTransaction({ to: faucetAddress, data: dataWithReferral, gasLimit });
    
    // 💡 UPDATED: Safe wait
    await safeWaitForReceipt(tx, provider);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));
    return tx.hash;
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to reset all claims");
  }
}

export async function setClaimParameters(
  provider: BrowserProvider,
  faucetAddress: string,
  claimAmount: bigint,
  startTime: number,
  endTime: number,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) throw new Error("Switch to the network to perform operation");
  try {
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const permissions = await checkPermissions(provider, faucetAddress, signerAddress, faucetType);
    if (permissions.isPaused) throw new Error("Faucet is paused");
    if (!permissions.isOwner && !permissions.isAdmin) throw new Error("Not authorized");

    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer);

    let data: string;
    if (detectedFaucetType === 'custom') data = faucetContract.interface.encodeFunctionData("setClaimParameters", [startTime, endTime]);
    else data = faucetContract.interface.encodeFunctionData("setClaimParameters", [claimAmount, startTime, endTime]);
    
    const dataWithReferral = appendDivviReferralData(data);
    const gasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, data: dataWithReferral, value: BigInt(0) }, BigInt(500000));

    const tx = await signer.sendTransaction({ to: faucetAddress, data: dataWithReferral, gasLimit });
    
    // 💡 UPDATED: Safe wait
    await safeWaitForReceipt(tx, provider);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));
    return tx.hash;
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to set parameters");
  }
}

export async function updateFaucetName(
  provider: BrowserProvider,
  faucet: string,
  name: string,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<`0x${string}`> {
  try {
    if (!checkNetwork(chainId, networkId)) throw new Error("Switch network");
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucet)
    const config = getFaucetConfig(detectedFaucetType)
    const data = new Contract(faucet, config.abi, signer).interface.encodeFunctionData("updateName", [name]);
    const dataWithReferral = appendDivviReferralData(data);
    const gasLimit = await estimateGasWithFallback(provider, { to: faucet, from: signerAddress, data: dataWithReferral, value: BigInt(0) }, BigInt(300000));

    const tx = await signer.sendTransaction({ to: faucet, data: dataWithReferral, gasLimit });
    
    // 💡 UPDATED: Safe wait
    await safeWaitForReceipt(tx, provider);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));
    return tx.hash as `0x${string}`;
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to update name");
  }
}

export async function deleteFaucet(
    provider: BrowserProvider,
    faucetAddress: string,
    chainId: bigint,
    networkId: bigint,
    faucetType?: FaucetType
): Promise<`0x${string}`> {
    try {
        if (!checkNetwork(chainId, networkId)) throw new Error("Switch network");
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();
        const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
        const config = getFaucetConfig(detectedFaucetType)
        const data = new Contract(faucetAddress, config.abi, signer).interface.encodeFunctionData("deleteFaucet", []);
        const dataWithReferral = appendDivviReferralData(data);
        const gasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, data: dataWithReferral, value: BigInt(0) }, BigInt(500000));

        const tx = await signer.sendTransaction({ to: faucetAddress, data: dataWithReferral, gasLimit });
        
        // 💡 UPDATED: Safe wait
        await safeWaitForReceipt(tx, provider);
        
        await deleteFaucetMetadata(faucetAddress, signerAddress, Number(chainId));
        await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));
        faucetDetailsCache.delete(faucetAddress);
        return tx.hash as `0x${string}`;
    } catch (error: any) {
        throw new Error(error.reason || error.message || "Failed to delete faucet");
    }
}

export async function addAdmin(
  provider: BrowserProvider,
  faucetAddress: string,
  adminAddress: string,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<`0x${string}`> {
  try {
    if (!checkNetwork(chainId, networkId)) throw new Error("Switch network");
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const data = new Contract(faucetAddress, config.abi, signer).interface.encodeFunctionData("addAdmin", [adminAddress]);
    const dataWithReferral = appendDivviReferralData(data);
    const gasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, data: dataWithReferral, value: BigInt(0) }, BigInt(300000));

    const tx = await signer.sendTransaction({ to: faucetAddress, data: dataWithReferral, gasLimit });
    
    // 💡 UPDATED: Safe wait
    await safeWaitForReceipt(tx, provider);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));
    return tx.hash as `0x${string}`;
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to add admin");
  }
}

export async function removeAdmin(
  provider: BrowserProvider,
  faucetAddress: string,
  adminAddress: string,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<`0x${string}`> {
  try {
    if (!checkNetwork(chainId, networkId)) throw new Error("Switch network");
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const data = new Contract(faucetAddress, config.abi, signer).interface.encodeFunctionData("removeAdmin", [adminAddress]);
    const dataWithReferral = appendDivviReferralData(data, signerAddress);
    const gasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, data: dataWithReferral, value: BigInt(0) }, BigInt(300000));

    const tx = await signer.sendTransaction({ to: faucetAddress, data: dataWithReferral, gasLimit });
    
    // 💡 UPDATED: Safe wait
    await safeWaitForReceipt(tx, provider);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));
    return tx.hash as `0x${string}`;
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to remove admin");
  }
}

export async function storeClaim(
  provider: BrowserProvider,
  claimer: string,
  faucetAddress: string,
  amount: bigint,
  txHash: string,
  chainId: number,
  networkId: number,
  networkName: string
): Promise<string> {
  if (!checkNetwork(BigInt(chainId), BigInt(networkId))) throw new Error("Switch network");
  try {
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const formattedTxHash = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
    const data = new Contract(STORAGE_CONTRACT_ADDRESS, STORAGE_ABI, signer).interface.encodeFunctionData("storeClaim", [claimer, formattedTxHash, amount, networkName, faucetAddress]);
    const dataWithReferral = appendDivviReferralData(data, signerAddress);
    const gasLimit = await estimateGasWithFallback(provider, { to: STORAGE_CONTRACT_ADDRESS, data: dataWithReferral, from: signerAddress, value: BigInt(0) }, BigInt(300000)); 

    const tx = await signer.sendTransaction({ to: STORAGE_CONTRACT_ADDRESS, data: dataWithReferral, gasLimit });
    
    // 💡 UPDATED: Safe wait
    const receipt = await safeWaitForReceipt(tx, provider);
    if (!receipt?.blockNumber) throw new Error("Transaction receipt is null or not mined");
    if (isSupportedNetwork(BigInt(chainId))) await reportTransactionToDivvi(tx.hash as `0x${string}`, chainId);
    return tx.hash;
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to store claim");
  }
}

export async function resetClaimedStatus(
  provider: BrowserProvider,
  faucetAddress: string,
  addresses: string[],
  status: boolean,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) throw new Error("Switch network")
  try {
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    if (detectedFaucetType !== 'dropcode') throw new Error("Only for dropcode faucets")
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress();
    const config = getFaucetConfig(detectedFaucetType)
    const data = new Contract(faucetAddress, config.abi, signer).interface.encodeFunctionData("resetClaimedBatch", [addresses])
    const dataWithReferral = appendDivviReferralData(data)
    const gasLimit = await estimateGasWithFallback(provider, { to: faucetAddress, from: signerAddress, data: dataWithReferral, value: BigInt(0) }, BigInt(500000));

    const tx = await signer.sendTransaction({ to: faucetAddress, data: dataWithReferral, gasLimit })
    
    // 💡 UPDATED: Safe wait
    await safeWaitForReceipt(tx, provider);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))
    return tx.hash
  } catch (error: any) {
    throw new Error(error.reason || error.message || "Failed to reset claimed status")
  }
}