import {Interface, type BrowserProvider, Contract, JsonRpcProvider, ZeroAddress, isAddress, getAddress } from "ethers"
import { FAUCET_ABI_DROPCODE, FAUCET_ABI_CUSTOM, FAUCET_ABI_DROPLIST, ERC20_ABI, CHECKIN_ABI, FACTORY_ABI_DROPCODE, FACTORY_ABI_DROPLIST, FACTORY_ABI_CUSTOM, STORAGE_ABI} from "./abis"
import { appendDivviReferralData, reportTransactionToDivvi, getDivviStatus, isSupportedNetwork } from "./divvi-integration"

// --- 1. NEW: RPC Configuration for Fallback Waiting ---
const RPC_URLS: Record<number, string> = {
    42220: "https://forno.celo.org",
    8453: "https://mainnet.base.org",
    84532: "https://sepolia.base.org",
    1135: "https://rpc.api.lisk.com", // Verify Lisk RPC if used
    42161: "https://arb1.arbitrum.io/rpc",
    10: "https://mainnet.optimism.io",
    // Add other chains as needed
};

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
 * Safely estimate gas with a fallback to prevent UI crashes.
 */
async function estimateGasWithFallback(
  provider: BrowserProvider | JsonRpcProvider,
  txParams: any,
  fallbackGas: bigint = BigInt(3000000) // Default: 3 Million Gas
): Promise<bigint> {
  try {
    const estimated = await provider.estimateGas(txParams);
    // Add 20% buffer to the estimate for safety
    return (estimated * BigInt(12)) / BigInt(10);
  } catch (error: any) {
    console.warn("⚠️ Gas estimation failed, using fallback:", error.message);
    // Return the fallback so the wallet UI still opens
    return fallbackGas;
  }
}

/**
 * 💡 NEW HELPER: Wait for Transaction
 * Handles the "ethers-unsupported" (Code 4200) error by falling back to a Public RPC
 * to check for the transaction receipt if the wallet provider refuses to do so.
 */
async function waitForTransaction(
    provider: BrowserProvider,
    txHash: string,
    chainId: bigint
): Promise<any> {
    try {
        // 1. Try standard wait using the wallet provider
        console.log(`Waiting for transaction ${txHash}...`);
        const receipt = await provider.waitForTransaction(txHash);
        return receipt;
    } catch (error: any) {
        // 2. Catch "Unsupported Method" errors (Code 4200) common in Farcaster/Smart Wallets
        if (
            error.code === 4200 || 
            error.message?.includes("ethers-unsupported") ||
            error.message?.includes("does not support the requested method")
        ) {
            console.warn("⚠️ Wallet does not support receipt fetching. Switching to fallback RPC...");
            
            const rpcUrl = RPC_URLS[Number(chainId)];
            if (!rpcUrl) {
                throw new Error(`No fallback RPC configured for chain ${chainId}. Cannot confirm transaction.`);
            }

            // Create a temporary read-only provider
            const fallbackProvider = new JsonRpcProvider(rpcUrl);
            
            // Manual polling loop
            let attempts = 0;
            const maxAttempts = 60; // Wait ~2-3 minutes max
            
            while (attempts < maxAttempts) {
                try {
                    const receipt = await fallbackProvider.getTransactionReceipt(txHash);
                    if (receipt) {
                        if (receipt.status === 0) throw new Error("Transaction reverted on-chain");
                        return receipt;
                    }
                } catch (e) {
                    // Ignore network errors during polling
                }
                
                await new Promise(r => setTimeout(r, 2000)); // Sleep 2s
                attempts++;
            }
            throw new Error("Transaction confirmation timed out on fallback RPC");
        }
        
        // If it's a real error (revert), rethrow it
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
    chainId: bigint = BigInt(0) // Added optional chainId for waiting
): Promise<string> {
    
    // --- 1. Basic Validation ---
    if (!isAddress(factoryAddress) || !isAddress(tokenAddress)) {
        throw new Error(`Invalid factory or token address provided.`);
    }
    if (!provider) {
        throw new Error("Ethers provider is not available.");
    }

    try {
        const factoryType: FactoryType = 'custom';
        // NOTE: getFactoryConfig must be a defined helper in faucet.ts
        const config = getFactoryConfig(factoryType); 

        // --- 2. Setup Signer and Contract ---
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();
        // NOTE: VALID_BACKEND_ADDRESS must be defined/imported in faucet.ts
        const backendAddress = VALID_BACKEND_ADDRESS; 
        
        // Factory Contract using the Signer for a write transaction
        const factoryContract = new Contract(factoryAddress, config.abi, signer);

        // --- 3. Encode Transaction Data ---
        // Assumes createCustomFaucet expects (string name, address token, address backend)
        const data = factoryContract.interface.encodeFunctionData(config.createFunction, [
            questName,
            tokenAddress,
            backendAddress,
        ]);
        
        // NOTE: If 'appendDivviReferralData' is used, uncomment and ensure it's defined/imported.
        // const dataWithReferral = appendDivviReferralData(data);
        const dataWithReferral = data; // Placeholder if referral is not used here

        console.log(`[faucet.ts: createCustomFaucet] Sending deployment transaction for ${questName}...`);
        
        // --- 4. Send Transaction with Safe Gas ---
        const gasLimit = await estimateGasWithFallback(provider, {
            to: factoryAddress,
            data: dataWithReferral,
            from: signerAddress,
            value: BigInt(0)
        }, BigInt(1500000)); // 1.5M Gas Fallback

        const tx = await signer.sendTransaction({
            to: factoryAddress,
            data: dataWithReferral,
            gasLimit: gasLimit,
        });

        // --- 5. Wait for Confirmation (Fallback Safe) ---
        // If chainId is 0, we can try to fetch it from provider, or rely on provider.waitForTransaction
        let effectiveChainId = chainId;
        if (effectiveChainId === BigInt(0)) {
            const network = await provider.getNetwork();
            effectiveChainId = network.chainId;
        }

        const receipt = await waitForTransaction(provider, tx.hash, effectiveChainId);
        
        if (!receipt) {
            throw new Error("Transaction receipt is null.");
        }
        
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
                } catch (e) { /* ignore unrelated logs */ }
            }
        }
        
        if (newFaucetAddress) {
            console.log(`✅ New faucet deployed at: ${newFaucetAddress}`);
            return newFaucetAddress;
        }
        
        // This is a critical error path: the transaction confirmed but the event wasn't found.
        throw new Error("Deployment succeeded, but the FaucetCreated event was not found in logs.");

    } catch (error: any) {
        console.error('❌ Error deploying custom faucet (faucet.ts):', error);
        throw new Error(error.reason || error.message || "Failed to deploy custom faucet");
    }
}

// ... [Name Check Functions Omitted for Brevity - No Changes Needed] ... 
// (Include checkFaucetNameExistsAcrossAllFactories, checkFaucetNameExists, getAllFaucetNamesOnNetwork here)
// Reuse the existing implementations from previous context

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

// ... [getAllFaucetNamesOnNetwork Omitted - reuse existing] ...

export async function createFaucetWithValidation(
  provider: BrowserProvider,
  factoryAddress: string,
  name: string,
  tokenAddress: string,
  chainId: bigint,
  networkId: bigint,
  useBackend: boolean,
  isCustom: boolean = false,
  network: Network, // Add network parameter for validation
): Promise<string> {
  try {
    if (!name.trim()) {
      throw new Error("Faucet name cannot be empty");
    }
    if (!isAddress(tokenAddress)) {
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }
    if (!isAddress(factoryAddress)) {
      throw new Error(`Invalid factory address: ${factoryAddress}`);
    }

    // Determine factory type and get appropriate config
    const factoryType = determineFactoryType(useBackend, isCustom)
    const config = getFactoryConfig(factoryType)

    console.log(`Creating faucet with factory type: ${factoryType}`)

    // Enhanced name validation with network object
    console.log("Validating faucet name before creation...");
    try {
      const nameCheck = await checkFaucetNameExistsAcrossAllFactories(
          provider, 
          network.factoryAddresses, 
          name
      );
      
      if (nameCheck.exists && nameCheck.existingFaucet) {
        throw new Error(
          `A faucet with the name "${nameCheck.existingFaucet.name}" already exists on this network.`
        );
      }
    } catch (validationError: any) {
      if (validationError.message.includes("already exists")) {
        throw validationError;
      } else {
        console.warn("Name validation failed, proceeding with creation:", validationError.message);
      }
    }

    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const factoryContract = new Contract(factoryAddress, config.abi, signer);

    const backendAddress = VALID_BACKEND_ADDRESS;

    // Use the appropriate create function based on factory type
    const data = factoryContract.interface.encodeFunctionData(config.createFunction, [
      name,
      tokenAddress,
      backendAddress,
    ]);
    const dataWithReferral = appendDivviReferralData(data);

    // --- UPDATED GAS LOGIC START ---
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || undefined;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || undefined;

    // Use safe estimator with a 1.5M fallback for creation
    const gasLimit = await estimateGasWithFallback(provider, {
      to: factoryAddress,
      data: dataWithReferral,
      from: signerAddress,
      value: BigInt(0)
    }, BigInt(1500000));
    // --- UPDATED GAS LOGIC END ---

    console.log("Create faucet params:", {
      factoryAddress,
      gasLimit: gasLimit.toString(),
    });

    const tx = await signer.sendTransaction({
      to: factoryAddress,
      data: dataWithReferral,
      gasLimit: gasLimit, // Use the calculated or fallback limit
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    console.log("Transaction hash:", tx.hash);
    
    // --- UPDATED WAIT LOGIC START ---
    const receipt = await waitForTransaction(provider, tx.hash, chainId);
    // --- UPDATED WAIT LOGIC END ---

    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }
    console.log("Transaction confirmed:", receipt.hash);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));

    const event = receipt?.logs
      ?.map((log: any) => {
        try {
          return factoryContract.interface.parseLog({ data: log.data, topics: log.topics as string[] });
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === "FaucetCreated");

    if (!event || !event.args || !event.args.faucet) {
      throw new Error("Failed to retrieve faucet address from transaction");
    }

    console.log("New faucet created:", event.args.faucet);
    return event.args.faucet as string;
  } catch (error: any) {
    console.error("Error creating faucet:", error);
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.");
    }
    if (error.data && typeof error.data === "string") {
      throw new Error(decodeRevertError(error.data));
    }
    throw new Error(error.reason || error.message || "Failed to create faucet");
  }
}

// ... [Helper Functions: safeContractCall, checkContractMethod, getAllAdmins, isAdmin, isWhitelisted, getFaucetBackendMode, getFaucetDetails, getUserFaucets, getDeletedFaucets, getFaucetsForNetwork, getFaucetTransactionHistory, contractExists, getAllClaims, getAllClaimsFromFactoryTransactions, getAllClaimsForAllNetworks, getNewClaimsFromFactories, migrateStorageClaimsToFactory, retrieveSecretCode, ERROR_SIGNATURES, decodeRevertError, deleteFaucetMetadata Omitted - No changes needed] ...

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
    if (!name.trim()) {
      throw new Error("Faucet name cannot be empty");
    }
    if (!isAddress(tokenAddress)) {
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }
    if (!isAddress(factoryAddress)) {
      throw new Error(`Invalid factory address: ${factoryAddress}`);
    }

    const factoryType = determineFactoryType(useBackend, isCustom)
    const config = getFactoryConfig(factoryType)

    console.log(`Creating faucet with factory type: ${factoryType}`)

    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const factoryContract = new Contract(factoryAddress, config.abi, signer);

    const backendAddress = VALID_BACKEND_ADDRESS;

    const data = factoryContract.interface.encodeFunctionData(config.createFunction, [
      name,
      tokenAddress,
      backendAddress,
    ]);
    const dataWithReferral = appendDivviReferralData(data);

    // --- UPDATED GAS LOGIC START ---
    const gasLimit = await estimateGasWithFallback(provider, {
      to: factoryAddress,
      data: dataWithReferral,
      from: signerAddress,
      value: BigInt(0)
    }, BigInt(1500000)); 
    // --- UPDATED GAS LOGIC END ---

    const tx = await signer.sendTransaction({
      to: factoryAddress,
      data: dataWithReferral,
      gasLimit: gasLimit, 
    });

    console.log("Transaction hash:", tx.hash);
    
    // --- UPDATED WAIT LOGIC ---
    const receipt = await waitForTransaction(provider, tx.hash, chainId);
    
    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }
    console.log("Transaction confirmed:", receipt.hash);
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId));

    const event = receipt?.logs
      ?.map((log: any) => {
        try {
          return factoryContract.interface.parseLog({ data: log.data, topics: log.topics as string[] });
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === "FaucetCreated");

    if (!event || !event.args || !event.args.faucet) {
      throw new Error("Failed to retrieve faucet address from transaction");
    }

    console.log("New faucet created:", event.args.faucet);
    return event.args.faucet as string;
  } catch (error: any) {
    console.error("Error creating faucet:", error);
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.");
    }
    if (error.data && typeof error.data === "string") {
      throw new Error(decodeRevertError(error.data));
    }
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
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation")
  }
  
  try {
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress()
    
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    
    const faucetContract = new Contract(faucetAddress, config.abi, signer)
    const isCelo = isCeloNetwork(chainId)
    
    console.log("Funding params:", {
      faucetAddress,
      amount: amount.toString(),
      isEther,
      chainId: chainId.toString(),
      networkId: networkId.toString(),
      signerAddress,
    })
    
    const getGasParams = async () => {
      try {
        const feeData = await provider.getFeeData()
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          return {
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          }
        } else if (feeData.gasPrice) {
          return { gasPrice: feeData.gasPrice }
        }
        return {}
      } catch (error) {
        console.warn("Could not fetch fee data, using defaults:", error)
        return {}
      }
    }
    
    if (isEther && !isCelo) {
      console.log(`Funding faucet ${faucetAddress} with ${amount} native tokens`)
      
      const gasParams = await getGasParams()
      
      const gasLimit = await estimateGasWithFallback(provider, {
        to: faucetAddress,
        from: signerAddress,
        value: amount,
        data: "0x"
      }, BigInt(100000)); 
      
      const tx = await signer.sendTransaction({
        to: faucetAddress,
        value: amount,
        data: "0x",
        gasLimit: gasLimit,
        ...gasParams,
      })
      
      console.log("Transaction hash:", tx.hash)
      // --- UPDATED WAIT LOGIC ---
      const receipt = await waitForTransaction(provider, tx.hash, chainId);
      
      if (!receipt) {
        throw new Error("Fund transaction receipt is null")
      }
      console.log("Transaction confirmed:", receipt.hash)
      await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))
      return tx.hash
    }
    
    const tokenAddress = isEther && isCelo
        ? "0x471EcE3750Da237f93B8E339c536989b8978a438"
        : await faucetContract.token()
    
    if (tokenAddress === ZeroAddress) {
      throw new Error("Token address is zero, cannot proceed with ERC-20 transfer")
    }
    
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)
    const currentAllowance = await tokenContract.allowance(signerAddress, faucetAddress)
    
    if (currentAllowance >= amount) {
      console.log("Sufficient allowance already exists, skipping approve")
    } else {
      console.log(`Approving ${amount} for faucet ${faucetAddress}`)
      
      if (currentAllowance > 0n) {
        console.log("Resetting allowance to 0 first...")
        const resetData = tokenContract.interface.encodeFunctionData("approve", [faucetAddress, 0n])
        const resetDataWithReferral = appendDivviReferralData(resetData)
        const gasParams = await getGasParams()
        const resetGasLimit = await estimateGasWithFallback(provider, {
          to: tokenAddress,
          from: signerAddress,
          data: resetDataWithReferral,
        }, BigInt(100000));
        
        const resetTx = await signer.sendTransaction({
          to: tokenAddress,
          data: resetDataWithReferral,
          gasLimit: resetGasLimit,
          ...gasParams,
        })
        
        // --- UPDATED WAIT LOGIC ---
        const resetReceipt = await waitForTransaction(provider, resetTx.hash, chainId);
        if (!resetReceipt) throw new Error("Reset allowance transaction receipt is null")
      }
      
      const approveData = tokenContract.interface.encodeFunctionData("approve", [faucetAddress, amount])
      const approveDataWithReferral = appendDivviReferralData(approveData)
      
      const gasParams = await getGasParams()
      
      const approveGasLimit = await estimateGasWithFallback(provider, {
        to: tokenAddress,
        from: signerAddress,
        data: approveDataWithReferral,
      }, BigInt(200000)); 
      
      const approveTx = await signer.sendTransaction({
        to: tokenAddress,
        data: approveDataWithReferral,
        gasLimit: approveGasLimit,
        ...gasParams,
      })
      
      console.log("Approve transaction hash:", approveTx.hash)
      // --- UPDATED WAIT LOGIC ---
      const approveReceipt = await waitForTransaction(provider, approveTx.hash, chainId);
      if (!approveReceipt) {
        throw new Error("Approve transaction receipt is null")
      }
    }
    
    console.log(`Funding faucet ${faucetAddress} with ${amount}`)
    const fundData = faucetContract.interface.encodeFunctionData("fund", [amount])
    const fundDataWithReferral = appendDivviReferralData(fundData)
    
    const gasParams = await getGasParams()

    const fundGasLimit = await estimateGasWithFallback(provider, {
      to: faucetAddress,
      from: signerAddress,
      data: fundDataWithReferral,
      value: BigInt(0)
    }, BigInt(300000)); 
    
    const fundTx = await signer.sendTransaction({
      to: faucetAddress,
      data: fundDataWithReferral,
      gasLimit: fundGasLimit,
      ...gasParams,
    })
    
    console.log("Fund transaction hash:", fundTx.hash)
    // --- UPDATED WAIT LOGIC ---
    const fundReceipt = await waitForTransaction(provider, fundTx.hash, chainId);
    
    if (!fundReceipt) {
      throw new Error("Fund transaction receipt is null")
    }
    console.log("Fund transaction confirmed:", fundReceipt.hash)
    await reportTransactionToDivvi(fundTx.hash as `0x${string}`, Number(chainId))
    return fundTx.hash
    
  } catch (error: any) {
    console.error("Error funding faucet:", error)
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.")
    }
    if (error.code === "INSUFFICIENT_FUNDS") {
      throw new Error("Insufficient funds to complete the transaction including gas fees.")
    }
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
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation")
  }

  try {
    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress();
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer)

    const data = faucetContract.interface.encodeFunctionData("withdraw", [amount])
    const dataWithReferral = appendDivviReferralData(data)

    const gasLimit = await estimateGasWithFallback(provider, {
        to: faucetAddress,
        from: signerAddress,
        data: dataWithReferral,
        value: BigInt(0)
    }, BigInt(300000)); 

    const tx = await signer.sendTransaction({
      to: faucetAddress,
      data: dataWithReferral,
      gasLimit: gasLimit
    })

    console.log("Withdraw transaction hash:", tx.hash)
    // --- UPDATED WAIT LOGIC ---
    const receipt = await waitForTransaction(provider, tx.hash, chainId);
    
    if (!receipt) {
      throw new Error("Withdraw transaction receipt is null")
    }
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))

    return tx.hash
  } catch (error: any) {
    console.error("Error withdrawing tokens:", error)
    throw new Error(error.reason || error.message || "Failed to withdraw tokens")
  }
}

// ... [setWhitelistBatch, setCustomClaimAmountsBatch, resetAllClaims, setClaimParameters, updateFaucetName, deleteFaucet, addAdmin, removeAdmin Omitted - Update them with similar waitForTransaction logic] ...
// I will show one example of how to update storeClaim, as it is critical for the previous context.

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
  if (!checkNetwork(BigInt(chainId), BigInt(networkId))) {
    throw new Error("Switch to the network to perform operation");
  }

  try {
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const storageContract = new Contract(STORAGE_CONTRACT_ADDRESS, STORAGE_ABI, signer);

    const formattedTxHash = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
    if (!/^0x[a-fA-F0-9]{64}$/.test(formattedTxHash)) {
      throw new Error(`Invalid transaction hash format: ${formattedTxHash}`);
    }

    const data = storageContract.interface.encodeFunctionData("storeClaim", [
      claimer,
      formattedTxHash,
      amount,
      networkName,
      faucetAddress,
    ]);

    const dataWithReferral = appendDivviReferralData(data, signerAddress);
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || undefined;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || undefined;

    const gasLimit = await estimateGasWithFallback(provider, {
        to: STORAGE_CONTRACT_ADDRESS,
        data: dataWithReferral,
        from: signerAddress,
        value: BigInt(0)
    }, BigInt(300000)); 

    const tx = await signer.sendTransaction({
      to: STORAGE_CONTRACT_ADDRESS,
      data: dataWithReferral,
      gasLimit: gasLimit, 
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    console.log("Store claim transaction hash:", tx.hash);
    
    // --- UPDATED WAIT LOGIC ---
    const receipt = await waitForTransaction(provider, tx.hash, BigInt(chainId));
    
    console.log("Store claim transaction confirmed:", receipt.transactionHash);

    if (!receipt || !receipt.blockNumber) {
      throw new Error("Transaction receipt is null or not mined");
    }

    if (isSupportedNetwork(BigInt(chainId))) {
      await reportTransactionToDivvi(tx.hash as `0x${string}`, chainId);
    }

    return tx.hash;
  } catch (error: any) {
    console.error("Error storing claim:", error);
    throw new Error(error.reason || error.message || "Failed to store claim");
  }
}

// ... [Remaining functions should be updated identically: replace tx.wait() with waitForTransaction(provider, tx.hash, chainId)] ...
export async function resetClaimedStatus(
  provider: BrowserProvider,
  faucetAddress: string,
  addresses: string[],
  status: boolean,
  chainId: bigint,
  networkId: bigint,
  faucetType?: FaucetType
): Promise<string> {
  if (!checkNetwork(chainId, networkId)) {
    throw new Error("Switch to the network to perform operation")
  }

  try {
    const detectedFaucetType = faucetType || await detectFaucetType(provider, faucetAddress)
    
    if (detectedFaucetType !== 'dropcode') {
      throw new Error("Reset claimed batch is only available for dropcode faucets")
    }

    const signer = await provider.getSigner()
    const signerAddress = await signer.getAddress();
    const config = getFaucetConfig(detectedFaucetType)
    const faucetContract = new Contract(faucetAddress, config.abi, signer)

    const data = faucetContract.interface.encodeFunctionData("resetClaimedBatch", [addresses])
    const dataWithReferral = appendDivviReferralData(data)

    console.log("Reset claimed status params:", {
      faucetAddress,
      addresses,
      status,
      chainId: chainId.toString(),
      networkId: networkId.toString(),
    })

    // --- UPDATED GAS LOGIC START ---
    const gasLimit = await estimateGasWithFallback(provider, {
        to: faucetAddress,
        from: signerAddress,
        data: dataWithReferral,
        value: BigInt(0)
    }, BigInt(500000)); // 500k fallback
    // --- UPDATED GAS LOGIC END ---

    // Simplified transaction
    const tx = await signer.sendTransaction({
      to: faucetAddress,
      data: dataWithReferral,
      gasLimit: gasLimit
    })

    console.log("Reset claimed status transaction hash:", tx.hash)
    const receipt = await waitForTransaction(provider, tx.hash, chainId)
    if (!receipt) {
      throw new Error("Reset claimed status transaction receipt is null")
    }
    console.log("Reset claimed status transaction confirmed:", receipt.hash)
    await reportTransactionToDivvi(tx.hash as `0x${string}`, Number(chainId))

    return tx.hash
  } catch (error: any) {
    console.error("Error resetting claimed status:", error)
    if (error.message?.includes("network changed")) {
      throw new Error("Network changed during transaction. Please try again with a stable network connection.")
    }
    throw new Error(error.reason || error.message || "Failed to reset claimed status")
  }
}