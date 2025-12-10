"use client"

import { useEffect, useState, useCallback } from "react";
import { useNetwork } from "@/hooks/use-network";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Coins, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { formatUnits, Contract, JsonRpcProvider, isAddress, ZeroAddress } from "ethers";
import { Network } from "@/hooks/use-network";
import { FACTORY_ABI_DROPCODE, FACTORY_ABI_DROPLIST, FACTORY_ABI_CUSTOM } from "@/lib/abis";

// Factory type definitions
type FactoryType = 'dropcode' | 'droplist' | 'custom'

interface FactoryConfig {
  abi: any[]
  createFunction: string
}

// Helper function to get the appropriate ABI and function based on factory type
function getFactoryConfig(factoryType: FactoryType): FactoryConfig {
  switch (factoryType) {
    case 'dropcode':
      return { abi: FACTORY_ABI_DROPCODE, createFunction: 'createBackendFaucet' }
    case 'droplist':
      return { abi: FACTORY_ABI_DROPLIST, createFunction: 'createWhitelistFaucet' }
    case 'custom':
      return { abi: FACTORY_ABI_CUSTOM, createFunction: 'createCustomFaucet' }
    default:
      throw new Error(`Unknown factory type: ${factoryType}`)
  }
}

// Helper function to detect factory type by trying different function calls
async function detectFactoryType(provider: JsonRpcProvider, factoryAddress: string): Promise<FactoryType> {
  const factoryTypes: FactoryType[] = ['dropcode', 'droplist', 'custom']
  
  for (const type of factoryTypes) {
    try {
      const config = getFactoryConfig(type)
      const contract = new Contract(factoryAddress, config.abi, provider)
      
      // Try to call getAllTransactions to see if it exists with this ABI
      await contract.getAllTransactions.staticCall()
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

// ERC20 ABI for symbol and decimals
const ERC20_ABI = [
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// Faucet ABI for getting faucet names and token addresses
const FAUCET_ABI = [
  {
    "inputs": [],
    "name": "name",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getName",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "faucetName",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokenAddress",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// Chain configurations
interface ChainConfig {
  chainId: number;
  name: string;
  displayName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  nativeTokenAddress: string;
  factoryAddresses: string[];
  rpcUrls: string[];
  blockExplorerUrlsUrls: string[];
  isTestnet?: boolean;
  defaultTokens: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  }[];
}

const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  42220: {
    chainId: 42220,
    name: "Celo",
    displayName: "Celo Mainnet",
    nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
    nativeTokenAddress: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    factoryAddresses: [
      "0xE3Ac30fa32E727386a147Fe08b4899Da4115202f",
      "0x9D6f441b31FBa22700bb3217229eb89b13FB49de",
    ],
    rpcUrls: ["https://forno.celo.org"],
    blockExplorerUrlsUrls: ["https://explorer.celo.org"],
    defaultTokens: [
      {
        address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
        name: "Celo Dollar",
        symbol: "cUSD",
        decimals: 18,
      },
      {
        address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
        name: "Celo Euro",
        symbol: "cEUR",
        decimals: 18,
      },
      {
        address: "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3",
        name: "Glo Dollar",
        symbol: "USDGLO",
        decimals: 18,
      },
      {
        address: "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a",
        name: "Good dollar",
        symbol: "G$",
        decimals: 18,
      },
    ],
  },
  42161: {
    chainId: 42161,
    name: "Arbitrum",
    displayName: "Arbitrum",
    nativeCurrency: { name: "ETHER", symbol: "ETH", decimals: 18 },
    nativeTokenAddress: ZeroAddress,
    factoryAddresses: [
      "0x96E9911df17e94F7048cCbF7eccc8D9b5eDeCb5C",
    ],
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    blockExplorerUrlsUrls: ["https://arbiscan.io"],
    isTestnet: true,
    defaultTokens: [
      {
        address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
      },
    ],
  },
  1135: {
    chainId: 1135,
    name: "Lisk",
    displayName: "Lisk Mainnet",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    nativeTokenAddress: ZeroAddress,
    factoryAddresses: [
      "0x4F5Cf906b9b2Bf4245dba9F7d2d7F086a2a441C2",
    ],
    rpcUrls: ["https://rpc.api.lisk.com"],
    blockExplorerUrlsUrls: ["https://blockscout.lisk.com"],
    defaultTokens: [
      {
        address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
      },
    ],
  },
  8453: {
    chainId: 8453,
    name: "Base",
    displayName: "Base Mainnet",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
    nativeTokenAddress: ZeroAddress,
    factoryAddresses: [
      "0xE3Ac30fa32E727386a147Fe08b4899Da4115202f",
      "0x9D6f441b31FBa22700bb3217229eb89b13FB49de",
    ],
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrlsUrls: ["https://basescan.org"],
    defaultTokens: [
      {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
      },
    ],
  },
}

// Local storage keys
const STORAGE_KEYS = {
  CLAIMS_DATA: 'faucet_claims_data',
  FAUCET_NAMES: 'faucet_names_cache',
  LAST_UPDATED: 'claims_last_updated'
};

// Cache duration (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Claim type definition
type ClaimType = {
  claimer: string;
  faucet: string;
  amount: bigint;
  networkName: string;
  timestamp: number;
  chainId: number;
  tokenSymbol: string;
  tokenDecimals: number;
  isEther: boolean;
};

// Helper function to get token information
async function getTokenInfo(
  tokenAddress: string,
  provider: JsonRpcProvider,
  chainId: number,
  isEther: boolean
): Promise<{ symbol: string; decimals: number }> {
  const chainConfig = CHAIN_CONFIGS[chainId];
  
  if (isEther) {
    return {
      symbol: chainConfig?.nativeCurrency.symbol || "ETH",
      decimals: chainConfig?.nativeCurrency.decimals || 18
    };
  }

  // Check if it's a known default token first
  if (chainConfig?.defaultTokens) {
    const knownToken = chainConfig.defaultTokens.find(
      token => token.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    if (knownToken) {
      return {
        symbol: knownToken.symbol,
        decimals: knownToken.decimals
      };
    }
  }

  // Query the token contract
  try {
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals()
    ]);
    
    return {
      symbol: symbol || "TOKEN",
      decimals: Number(decimals) || 18
    };
  } catch (error) {
    console.warn(`Error fetching token info for ${tokenAddress}:`, error);
    return {
      symbol: "TOKEN",
      decimals: 18
    };
  }
}

// Function to get claims from factories for a single network
async function getAllClaimsFromFactories(
  provider: JsonRpcProvider,
  network: Network,
): Promise<{
  faucetAddress: string
  transactionType: string
  initiator: string
  amount: bigint
  isEther: boolean
  timestamp: number
  networkName: string
  chainId: number
  tokenSymbol: string
  tokenDecimals: number
}[]> {
  try {
    let allClaims: any[] = [];

    // Iterate through all factory addresses
    for (const factoryAddress of network.factoryAddresses) {
      if (!isAddress(factoryAddress)) {
        console.warn(`Invalid factory address ${factoryAddress} on ${network.name}`);
        continue;
      }

      // Detect factory type and get appropriate ABI
      let factoryType: FactoryType;
      let config: FactoryConfig;
      
      try {
        factoryType = await detectFactoryType(provider, factoryAddress);
        config = getFactoryConfig(factoryType);
        console.log(`Detected factory type for ${factoryAddress}: ${factoryType}`);
      } catch (error) {
        console.warn(`Could not detect factory type for ${factoryAddress}, using default:`, error);
        factoryType = 'dropcode';
        config = getFactoryConfig(factoryType);
      }

      const factoryContract = new Contract(factoryAddress, config.abi, provider);

      // Check if factory contract exists
      const code = await provider.getCode(factoryAddress);
      if (code === "0x") {
        console.warn(`No contract at factory address ${factoryAddress} on ${network.name}`);
        continue;
      }

      try {
        console.log(`Fetching transactions from factory ${factoryAddress} (${factoryType}) on ${network.name}...`);
        const allTransactions = await factoryContract.getAllTransactions();
        
        // Filter for claim transactions only
        const claimTransactions = allTransactions.filter((tx: any) => {
          const transactionType = tx.transactionType.toLowerCase();
          return transactionType === 'claim' || 
                 (transactionType.includes('claim') && !transactionType.includes('setclaimparameters'));
        });
        
        console.log(`Found ${claimTransactions.length} claim transactions from factory ${factoryAddress} (${factoryType})`);
        allClaims.push(...claimTransactions);
      } catch (error) {
        console.warn(`Error fetching transactions from factory ${factoryAddress}:`, error);
      }
    }

    // Process claims and get additional information
    const processedClaims = await Promise.all(
      allClaims.map(async (claim) => {
        // Get token information
        let tokenInfo;
        if (claim.isEther) {
          tokenInfo = await getTokenInfo("", provider, network.chainId, true);
        } else {
          try {
            const faucetContract = new Contract(claim.faucetAddress, FAUCET_ABI, provider);
            let tokenAddress;
            
            try {
              tokenAddress = await faucetContract.token();
            } catch {
              try {
                tokenAddress = await faucetContract.tokenAddress();
              } catch {
                const chainConfig = CHAIN_CONFIGS[network.chainId];
                tokenAddress = chainConfig?.nativeTokenAddress || ZeroAddress;
              }
            }
            
            tokenInfo = await getTokenInfo(tokenAddress, provider, network.chainId, false);
          } catch (error) {
            console.warn(`Error getting token info for faucet ${claim.faucetAddress}:`, error);
            tokenInfo = { symbol: "TOKEN", decimals: 18 };
          }
        }

        return {
          faucetAddress: claim.faucetAddress,
          transactionType: claim.transactionType,
          initiator: claim.initiator,
          amount: BigInt(claim.amount),
          isEther: claim.isEther,
          timestamp: Number(claim.timestamp),
          networkName: network.name,
          chainId: network.chainId,
          tokenSymbol: tokenInfo.symbol,
          tokenDecimals: tokenInfo.decimals
        };
      })
    );

    return processedClaims;
  } catch (error: any) {
    console.error(`Error fetching claims from factories on ${network.name}:`, error);
    throw new Error(error.message || "Failed to fetch claims from factories");
  }
}

// Function to get all claims from all networks
async function getAllClaimsFromAllNetworks(
  networks: Network[]
): Promise<ClaimType[]> {
  const allClaims: ClaimType[] = [];

  for (const network of networks) {
    try {
      console.log(`Fetching claims from ${network.name}...`);
      
      const provider = new JsonRpcProvider(network.rpcUrl);
      const networkClaims = await getAllClaimsFromFactories(provider, network);
      
      // Convert to ClaimType format
      const convertedClaims: ClaimType[] = networkClaims.map(claim => ({
        claimer: claim.initiator,
        faucet: claim.faucetAddress,
        amount: claim.amount,
        networkName: claim.networkName,
        timestamp: claim.timestamp,
        chainId: claim.chainId,
        tokenSymbol: claim.tokenSymbol,
        tokenDecimals: claim.tokenDecimals,
        isEther: claim.isEther,
      }));
      
      allClaims.push(...convertedClaims);
      console.log(`Added ${convertedClaims.length} claims from ${network.name}`);
    } catch (error) {
      console.error(`Error fetching claims from ${network.name}:`, error);
    }
  }

  // Sort by timestamp (newest first)
  allClaims.sort((a, b) => b.timestamp - a.timestamp);

  console.log(`Total claims from all networks: ${allClaims.length}`);
  return allClaims;
}

// Function to save data to localStorage
function saveToLocalStorage(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data, (k, v) => 
      typeof v === 'bigint' ? v.toString() : v
    ));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
}

// Function to load data from localStorage
function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    
    return JSON.parse(data, (k, v) => {
      // Convert amount back to bigint
      if (k === 'amount' && typeof v === 'string') {
        return BigInt(v);
      }
      return v;
    });
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return null;
  }
}

// Function to check if cache is valid
function isCacheValid(): boolean {
  const lastUpdated = loadFromLocalStorage<number>(STORAGE_KEYS.LAST_UPDATED);
  if (!lastUpdated) return false;
  
  return Date.now() - lastUpdated < CACHE_DURATION;
}

export function FaucetList() {
  const { networks } = useNetwork();
  const { toast } = useToast();
  
  const [claims, setClaims] = useState<ClaimType[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [faucetNames, setFaucetNames] = useState<Record<string, string>>({});
  const [isMobile, setIsMobile] = useState(false);
  
  // Dynamic claims per page based on screen size
  const claimsPerPage = isMobile ? 5 : 10;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Function to fetch faucet names
  const fetchFaucetNames = useCallback(async (claimsData: ClaimType[]) => {
    // Load cached names first
    const cachedNames = loadFromLocalStorage<Record<string, string>>(STORAGE_KEYS.FAUCET_NAMES) || {};
    setFaucetNames(cachedNames);

    const faucetAddresses = [...new Set(claimsData.map(claim => claim.faucet))];
    const uncachedAddresses = faucetAddresses.filter(addr => !cachedNames[addr]);
    
    if (uncachedAddresses.length === 0) return;

    console.log(`Fetching names for ${uncachedAddresses.length} uncached faucets...`);
    
    const namePromises = uncachedAddresses.map(async (faucetAddress) => {
      try {
        const claim = claimsData.find(c => c.faucet === faucetAddress);
        if (!claim) return null;
        
        const network = networks.find(n => n.chainId === claim.chainId);
        if (!network) return null;
        
        const provider = new JsonRpcProvider(network.rpcUrl);
        const faucetContract = new Contract(faucetAddress, FAUCET_ABI, provider);
        
        let faucetName: string;
        try {
          faucetName = await faucetContract.name();
        } catch {
          try {
            faucetName = await faucetContract.getName();
          } catch {
            try {
              faucetName = await faucetContract.faucetName();
            } catch {
              return null;
            }
          }
        }
        
        return { address: faucetAddress, name: faucetName };
      } catch (error) {
        console.log(`Error fetching name for faucet ${faucetAddress}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(namePromises);
    const newNames: Record<string, string> = { ...cachedNames };
    
    results.forEach(result => {
      if (result && result.name) {
        newNames[result.address] = result.name;
      }
    });
    
    setFaucetNames(newNames);
    saveToLocalStorage(STORAGE_KEYS.FAUCET_NAMES, newNames);
  }, [networks]);

  // Function to load claims
  const loadClaims = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoadingClaims(true);
    }
    
    try {
      let claimsData: ClaimType[];
      
      // Check if we should use cached data
      if (!forceRefresh && isCacheValid()) {
        const cachedClaims = loadFromLocalStorage<ClaimType[]>(STORAGE_KEYS.CLAIMS_DATA);
        if (cachedClaims && cachedClaims.length > 0) {
          console.log('Using cached claims data');
          claimsData = cachedClaims;
          setClaims(claimsData);
          setPage(1);
          
          // Fetch faucet names for cached data
          await fetchFaucetNames(claimsData);
          
          if (!forceRefresh) {
            setLoadingClaims(false);
          }
        } else {
          // Fetch fresh data if no valid cache
          claimsData = await getAllClaimsFromAllNetworks(networks);
        }
      } else {
        // Fetch fresh data
        console.log('Fetching fresh claims data from multi-ABI factories...');
        claimsData = await getAllClaimsFromAllNetworks(networks);
      }

      // If we fetched fresh data, update state and cache
      if (forceRefresh || !isCacheValid()) {
        setClaims(claimsData);
        setPage(1);
        
        // Save to cache
        saveToLocalStorage(STORAGE_KEYS.CLAIMS_DATA, claimsData);
        saveToLocalStorage(STORAGE_KEYS.LAST_UPDATED, Date.now());
        
        // Fetch faucet names
        await fetchFaucetNames(claimsData);
        
        if (forceRefresh) {
          toast({
            title: "Drops refreshed",
            description: `Loaded ${claimsData.length} total drops from all factory types`,
          });
        }
      }
      
    } catch (error) {
      console.error("Error loading drops:", error);
      toast({
        title: "Failed to load drops",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingClaims(false);
      setRefreshing(false);
    }
  }, [networks, toast, fetchFaucetNames]);

  // Background refresh function
  const backgroundRefresh = useCallback(async () => {
    if (networks.length === 0) return;
    
    try {
      const freshClaims = await getAllClaimsFromAllNetworks(networks);
      
      // Only update if we got new data
      if (freshClaims.length > 0) {
        setClaims(freshClaims);
        saveToLocalStorage(STORAGE_KEYS.CLAIMS_DATA, freshClaims);
        saveToLocalStorage(STORAGE_KEYS.LAST_UPDATED, Date.now());
        
        // Update faucet names in background
        fetchFaucetNames(freshClaims);
      }
    } catch (error) {
      console.warn("Background refresh failed:", error);
    }
  }, [networks, fetchFaucetNames]);

  // Initial load effect
  useEffect(() => {
    if (networks.length > 0) {
      loadClaims();
    }
  }, [networks, loadClaims]);

  // Background refresh effect
  useEffect(() => {
    if (networks.length === 0) return;

    // Set up periodic background refresh
    const interval = setInterval(() => {
      backgroundRefresh();
    }, CACHE_DURATION);

    return () => clearInterval(interval);
  }, [networks, backgroundRefresh]);

  // Reset pagination when mobile state changes
  useEffect(() => {
    setPage(1);
  }, [isMobile]);

  const handleRefresh = () => {
    loadClaims(true);
  };

  const totalPages = Math.ceil(claims.length / claimsPerPage);
  const paginatedClaims = claims.slice((page - 1) * claimsPerPage, page * claimsPerPage);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg sm:text-xl">Recent Drops</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={loadingClaims || refreshing}
              className="flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-sm"
            >
              {isExpanded ? (
                <>
                  Collapse
                  <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  View Drops
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
        {isExpanded && claims.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Total: {claims.length} drops from all factory types • Last updated: {
              loadFromLocalStorage<number>(STORAGE_KEYS.LAST_UPDATED) 
                ? new Date(loadFromLocalStorage<number>(STORAGE_KEYS.LAST_UPDATED)!).toLocaleTimeString()
                : 'Never'
            }
          </div>
        )}
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          {loadingClaims ? (
            <div className="flex justify-center items-center py-10 sm:py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-sm sm:text-base">Loading drops from multi-ABI factory contracts...</p>
              </div>
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Coins className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-medium mb-2">No Drops Found</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                No drops have been recorded across any network yet.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View */}
              <div className="block sm:hidden space-y-3">
                {paginatedClaims.map((claim, index) => {
                  const network = networks.find((n) => n.chainId === claim.chainId);
                  const displayName = faucetNames[claim.faucet] || `Faucet ${claim.faucet.slice(0, 6)}...${claim.faucet.slice(-4)}`;
                  return (
                    <Card key={`${claim.faucet}-${index}`} className="p-3">
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="text-muted-foreground">Dropee:</span>
                          <span className="font-mono text-right break-all max-w-[150px]">
                            {claim.claimer.slice(0, 6)}...{claim.claimer.slice(-4)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-start">
                          <span className="text-muted-foreground">Faucet:</span>
                          <Link
                            href={`/faucet/${claim.faucet}?networkId=${claim.chainId}`}
                            className="text-blue-600 hover:underline text-right max-w-[150px] truncate"
                          >
                            {displayName}
                          </Link>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">
                            {Number(formatUnits(claim.amount, claim.tokenDecimals)).toFixed(4)} {claim.tokenSymbol}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Network:</span>
                          <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {claim.networkName}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Time:</span>
                          <span className="text-right">
                            {new Date(claim.timestamp * 1000).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Dropee</TableHead>
                      <TableHead className="text-xs sm:text-sm">Faucet</TableHead>
                      <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                      <TableHead className="text-xs sm:text-sm">Network</TableHead>
                      <TableHead className="text-xs sm:text-sm">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClaims.map((claim, index) => {
                      const network = networks.find((n) => n.chainId === claim.chainId);
                      const displayName = faucetNames[claim.faucet] || `Faucet ${claim.faucet.slice(0, 6)}...${claim.faucet.slice(-4)}`;
                      return (
                        <TableRow key={`${claim.faucet}-${index}`}>
                          <TableCell className="text-xs sm:text-sm font-mono">
                            <div className="max-w-[120px] truncate" title={claim.claimer}>
                              {claim.claimer}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <Link
                              href={`/faucet/${claim.faucet}?networkId=${claim.chainId}`}
                              className="text-blue-600 hover:underline max-w-[120px] truncate block"
                              title={displayName}
                            >
                              {displayName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {Number(formatUnits(claim.amount, claim.tokenDecimals)).toFixed(4)} {claim.tokenSymbol}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800">
                              {claim.networkName}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {new Date(claim.timestamp * 1000).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Showing {(page - 1) * claimsPerPage + 1} to {Math.min(page * claimsPerPage, claims.length)} of{" "}
                    {claims.length} drops
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1 || loadingClaims || refreshing}
                      className="text-xs sm:text-sm hover:bg-primary/10"
                      aria-label="Previous page"
                    >
                      Previous
                    </Button>
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || loadingClaims || refreshing}
                      className="text-xs sm:text-sm hover:bg-primary/10"
                      aria-label="Next page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}