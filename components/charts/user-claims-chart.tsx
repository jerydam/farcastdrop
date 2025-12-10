"use client"
import { useEffect, useState, useCallback } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { Loader2, RefreshCw, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { JsonRpcProvider, Contract, isAddress, formatUnits, ZeroAddress } from "ethers"
import { useNetwork } from "@/hooks/use-network"
import { FACTORY_ABI, FAUCET_ABI, ERC20_ABI } from "@/lib/abis" // Assuming FAUCET_ABI and ERC20_ABI are defined elsewhere
import { useToast } from "@/hooks/use-toast"
import { DataService, ClaimData } from "@/lib/database-helpers"

// Chain configurations
interface ChainConfig {
  chainId: number
  name: string
  displayName: string
  nativeCurrency: { name: string; symbol: string; decimals: number }
  nativeTokenAddress: string
  factoryAddresses: string[]
  rpcUrls: string[]
  blockExplorerUrlsUrls: string[]
  isTestnet?: boolean
  defaultTokens: {
    address: string
    name: string
    symbol: string
    decimals: number
  }[]
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
    blockExplorerUrlsUrls: ["https://celoscan.io/"],
    defaultTokens: [
      {
        address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
        name: "Celo Dollar",
        symbol: "cUSD",
        decimals: 18,
      },
    ],
  },
  // Add other chain configs as needed...
}

// Local storage keys for faucet names caching
const STORAGE_KEYS = {
  FAUCET_NAMES: 'faucet_names_cache',
  CLAIMS_DATA: 'faucet_claims_data',
  LAST_UPDATED: 'claims_last_updated',
  TOTAL_CLAIMS: 'totalclaim'
}

// Cache duration (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000

// Claim type definition (UPDATED to include faucetName)
type ClaimType = {
  claimer: string
  faucet: string
  amount: bigint
  networkName: string
  timestamp: number
  chainId: number
  tokenSymbol: string
  tokenDecimals: number
  isEther: boolean
  faucetName?: string // Now included from chain fetch
}

// Helper function to save data to localStorage
function saveToLocalStorage(key: string, data: any) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(data, (k, v) => 
        typeof v === 'bigint' ? v.toString() : v
      ))
    }
  } catch (error) {
    console.warn('Failed to save to localStorage:', error)
  }
}

// Helper function to load data from localStorage
function loadFromLocalStorage<T>(key: string): T | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = localStorage.getItem(key)
      if (!data) return null
      return JSON.parse(data, (k, v) => {
        if (k === 'amount' && typeof v === 'string') {
          return BigInt(v)
        }
        return v
      })
    }
    return null
  } catch (error) {
    console.warn('Failed to load from localStorage:', error)
    return null
  }
}

// Function to check if cache is valid
function isCacheValid(): boolean {
  const lastUpdated = loadFromLocalStorage<number>(STORAGE_KEYS.LAST_UPDATED)
  if (!lastUpdated) return false
  
  return Date.now() - lastUpdated < CACHE_DURATION
}

// Helper function to get token information
async function getTokenInfo(
  tokenAddress: string,
  provider: JsonRpcProvider,
  chainId: number,
  isEther: boolean
): Promise<{ symbol: string; decimals: number }> {
  const chainConfig = CHAIN_CONFIGS[chainId]
  
  if (isEther) {
    return {
      symbol: chainConfig?.nativeCurrency.symbol || "ETH",
      decimals: chainConfig?.nativeCurrency.decimals || 18
    }
  }

  // Check if it's a known default token first
  if (chainConfig?.defaultTokens) {
    const knownToken = chainConfig.defaultTokens.find(
      token => token.address.toLowerCase() === tokenAddress.toLowerCase()
    )
    if (knownToken) {
      return {
        symbol: knownToken.symbol,
        decimals: knownToken.decimals
      }
    }
  }

  // Query the token contract
  try {
    // Assuming ERC20_ABI includes symbol() and decimals()
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider)
    const [symbol, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals()
    ])
    
    return {
      symbol: symbol || "TOKEN",
      decimals: Number(decimals) || 18
    }
  } catch (error) {
    console.warn(`Error fetching token info for ${tokenAddress}:`, error)
    return {
      symbol: "TOKEN",
      decimals: 18
    }
  }
}

// NEW HELPER: Robustly get the faucet name
async function getFaucetName(
  faucetAddress: string,
  provider: JsonRpcProvider
): Promise<string> {
  const defaultName = `Faucet ${faucetAddress.slice(0, 6)}...${faucetAddress.slice(-4)}`;
  
  // Try common name functions (assuming FAUCET_ABI includes them, or we define custom ABIs here)
  const nameFunctions = ['name', 'getName', 'faucetName'];
  
  for (const func of nameFunctions) {
    try {
      // Create a temporary contract interface just for this function call
      const contract = new Contract(faucetAddress, [{
        "inputs": [],
        "name": func,
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
      }], provider);
      
      const fetchedName = await contract[func]();
      
      if (fetchedName && fetchedName.trim() !== '' && fetchedName !== ZeroAddress) {
        return fetchedName;
      }
    } catch (error) {
      // Ignore errors and try the next function
    }
  }

  return defaultName;
}


// Function to get claims from factories for a single network (UPDATED to fetch name)
async function getAllClaimsFromFactories(
  provider: JsonRpcProvider,
  network: any,
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
  faucetName: string // Explicitly added to the return type
}[]> {
  try {
    let allClaims: any[] = []
    
    for (const factoryAddress of network.factoryAddresses) {
      if (!isAddress(factoryAddress)) {
        console.warn(`Invalid factory address ${factoryAddress} on ${network.name}`)
        continue
      }
      // Assuming FACTORY_ABI includes getAllTransactions()
      const factoryContract = new Contract(factoryAddress, FACTORY_ABI, provider)
      
      const code = await provider.getCode(factoryAddress)
      if (code === "0x") {
        console.warn(`No contract at factory address ${factoryAddress} on ${network.name}`)
        continue
      }

      try {
        console.log(`Fetching transactions from factory ${factoryAddress} on ${network.name}...`)
        const allTransactions = await factoryContract.getAllTransactions()
        
        const claimTransactions = allTransactions.filter((tx: any) => {
          const transactionType = tx.transactionType.toLowerCase();
          return transactionType === 'claim' || 
                 (transactionType.includes('claim') && !transactionType.includes('setclaimparameters'));
        });
        
        console.log(`Found ${claimTransactions.length} claim transactions from factory ${factoryAddress}`)
        allClaims.push(...claimTransactions)
      } catch (error) {
        console.warn(`Error fetching transactions from factory ${factoryAddress}:`, error)
      }
    }

    // Process claims and get additional information
    const processedClaims = await Promise.all(
      allClaims.map(async (claim) => {
        
        let tokenInfo;
        let tokenAddress = ZeroAddress;
        let faucetName = '';

        if (claim.isEther) {
          tokenInfo = await getTokenInfo("", provider, network.chainId, true)
          faucetName = `${network.nativeCurrency.symbol} Faucet (Native)`;
        } else {
          // --- Fetch Token Address ---
          try {
            const faucetContract = new Contract(claim.faucetAddress, FAUCET_ABI, provider)
            
            try {
              tokenAddress = await faucetContract.token()
            } catch {
              try {
                tokenAddress = await faucetContract.tokenAddress()
              } catch {
                const chainConfig = CHAIN_CONFIGS[network.chainId]
                tokenAddress = chainConfig?.nativeTokenAddress || ZeroAddress
              }
            }
          } catch (error) {
             // Failed to get token address, proceed with default/native address
          }
            
          // --- Fetch Token Info AND Faucet Name concurrently ---
          try {
            const [fetchedTokenInfo, fetchedFaucetName] = await Promise.all([
                getTokenInfo(tokenAddress, provider, network.chainId, false),
                getFaucetName(claim.faucetAddress, provider)
            ]);

            tokenInfo = fetchedTokenInfo;
            faucetName = fetchedFaucetName;
          } catch (error) {
            console.warn(`Error fetching details for faucet ${claim.faucetAddress}:`, error);
            tokenInfo = { symbol: "TOKEN", decimals: 18 };
            faucetName = `Faucet ${claim.faucetAddress.slice(0, 6)}...${claim.faucetAddress.slice(-4)}`;
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
          tokenDecimals: tokenInfo.decimals,
          faucetName: faucetName // <-- Now included
        }
      })
    )

    return processedClaims
  } catch (error: any) {
    console.error(`Error fetching claims from factories on ${network.name}:`, error)
    throw new Error(error.message || "Failed to fetch claims from factories")
  }
}

// Function to get all claims from all networks (UPDATED to map faucetName)
async function getAllClaimsFromAllNetworks(
  networks: any[]
): Promise<ClaimType[]> {
  const allClaims: ClaimType[] = []

  for (const network of networks) {
    try {
      console.log(`Fetching claims from ${network.name}...`)
      
      const provider = new JsonRpcProvider(network.rpcUrl)
      const networkClaims = await getAllClaimsFromFactories(provider, network)
      
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
        faucetName: claim.faucetName, // <-- Now mapped
      }))
      
      allClaims.push(...convertedClaims)
      console.log(`Added ${convertedClaims.length} claims from ${network.name}`)
    } catch (error) {
      console.error(`Error fetching claims from ${network.name}:`, error)
    }
  }

  // Sort by timestamp (newest first)
  allClaims.sort((a, b) => b.timestamp - a.timestamp)
  console.log(`Total claims from all networks: ${allClaims.length}`)
  return allClaims
}

interface ChartClaimData {
  name: string
  value: number
  color: string
  faucetAddress: string
}

interface FaucetRanking {
  rank: number
  faucetAddress: string
  faucetName: string
  network: string
  chainId: number
  totalClaims: number
  latestClaimTime: number
  totalAmount: string
}

export function UserClaimsChart() {
  const { networks } = useNetwork()
  const { toast } = useToast()
  const [data, setData] = useState<ChartClaimData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalClaims, setTotalClaims] = useState(0)
  const [totalFaucets, setTotalFaucets] = useState(0)
  const [faucetNames, setFaucetNames] = useState<Record<string, string>>({})
  const [faucetRankings, setFaucetRankings] = useState<FaucetRanking[]>([])
  
  useEffect(() => {
    // Load cached totalClaims on mount
    const stored = localStorage.getItem('totalclaim')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (typeof parsed === 'number') {
          setTotalClaims(parsed)
        }
      } catch (e) {
        console.warn('Error parsing cached totalClaims:', e)
      }
    }
  }, [])

  // Generate colors for the pie chart
  const generateColors = (count: number) => {
    const colors = []
    for (let i = 0; i < count; i++) {
      const hue = (i * 137.508) % 360 // Golden angle approximation for better color distribution
      colors.push(`hsl(${hue}, 70%, 60%)`)
    }
    return colors
  }

  // Function to fetch faucet names with caching (SIMPLIFIED)
  const fetchFaucetNames = useCallback(async (claimsData: ClaimType[]) => {
    // Load cached names first
    const cachedNames = loadFromLocalStorage<Record<string, string>>(STORAGE_KEYS.FAUCET_NAMES) || {};
    let newNames: Record<string, string> = { ...cachedNames };

    // Update with names freshly retrieved from the chain (present in claimsData)
    claimsData.forEach(claim => {
        if (claim.faucetName) {
            newNames[claim.faucet.toLowerCase()] = claim.faucetName;
        }
    });

    setFaucetNames(newNames);
    saveToLocalStorage(STORAGE_KEYS.FAUCET_NAMES, newNames);
    return newNames;
  }, []);

  const fetchAndStoreData = async () => {
    setLoading(true)
    try {
      console.log("Fetching claims from factory sources...")
      
      // Claims now include faucetName
      const allClaims = await getAllClaimsFromAllNetworks(networks)
      console.log("Fetched factory claims:", allClaims.length)

      const claimsByFaucet: { [key: string]: { 
        claims: number, 
        network: string,
        chainId: number,
        totalAmount: bigint,
        tokenSymbol: string,
        tokenDecimals: number,
        latestTimestamp: number
      } } = {}

      let totalClaimsCount = allClaims.length

      // Process all claims
      for (const claim of allClaims) {
        const faucetKey = claim.faucet.toLowerCase()
        
        if (!claimsByFaucet[faucetKey]) {
          claimsByFaucet[faucetKey] = { 
            claims: 0, 
            network: claim.networkName,
            chainId: claim.chainId,
            totalAmount: BigInt(0),
            tokenSymbol: claim.tokenSymbol,
            tokenDecimals: claim.tokenDecimals,
            latestTimestamp: 0
          }
        }
        
        claimsByFaucet[faucetKey].claims += 1
        claimsByFaucet[faucetKey].totalAmount += claim.amount
        
        if (claim.timestamp > claimsByFaucet[faucetKey].latestTimestamp) {
          claimsByFaucet[faucetKey].latestTimestamp = claim.timestamp
        }
      }

      setTotalClaims(totalClaimsCount)
      setTotalFaucets(Object.keys(claimsByFaucet).length)

      // Fetch faucet names with caching (Populates faucetNames state and cache)
      const combinedNames = await fetchFaucetNames(allClaims)

      // Create faucet rankings
      const rankingData: FaucetRanking[] = Object.entries(claimsByFaucet)
        .sort(([, a], [, b]) => b.latestTimestamp - a.latestTimestamp)
        .map(([faucet, data], index) => {
           const faucetName = combinedNames[faucet] || `Faucet ${faucet.slice(0, 6)}...${faucet.slice(-4)}`;
           return {
              rank: index + 1,
              faucetAddress: faucet,
              faucetName: faucetName,
              network: data.network,
              chainId: data.chainId,
              totalClaims: data.claims,
              latestClaimTime: data.latestTimestamp,
              totalAmount: `${Number(formatUnits(data.totalAmount, data.tokenDecimals)).toFixed(4)} ${data.tokenSymbol}`
           }
        })

      setFaucetRankings(rankingData)

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.TOTAL_CLAIMS, JSON.stringify(totalClaimsCount))
        console.log('Saved totalClaims to localStorage:', totalClaimsCount)
      }

      // Convert to chart data format - show ONLY TOP 10 faucets
      const sortedFaucets = Object.entries(claimsByFaucet)
        .sort(([, a], [, b]) => b.claims - a.claims)
      
      const top10Faucets = sortedFaucets.slice(0, 10)
      const otherFaucets = sortedFaucets.slice(10)
      
      const otherTotalClaims = otherFaucets.reduce((sum, [, data]) => sum + data.claims, 0)
      
      const colors = generateColors(top10Faucets.length + (otherTotalClaims > 0 ? 1 : 0))
      
      const chartData: ChartClaimData[] = top10Faucets.map(([faucet, data], index) => {
        const faucetName = combinedNames[faucet] || `${faucet.slice(0, 6)}...${faucet.slice(-4)}`
        return {
          name: faucetName,
          value: data.claims,
          color: colors[index],
          faucetAddress: faucet
        }
      })

      if (otherTotalClaims > 0) {
        chartData.push({
          name: `Others (${otherFaucets.length} faucets)`,
          value: otherTotalClaims,
          color: colors[top10Faucets.length],
          faucetAddress: 'others'
        })
      }

      // Save to cache
      saveToLocalStorage(STORAGE_KEYS.CLAIMS_DATA, allClaims)
      saveToLocalStorage(STORAGE_KEYS.LAST_UPDATED, Date.now())

      // Save to Supabase
      const supabaseClaimData: Omit<ClaimData, 'id' | 'updated_at'>[] = rankingData.map(item => ({
        faucet_address: item.faucetAddress,
        faucet_name: item.faucetName,
        network: item.network,
        chain_id: item.chainId,
        claims: item.totalClaims,
        total_amount: item.totalAmount,
        latest_claim_time: item.latestClaimTime
      }))
      await DataService.saveClaimData(supabaseClaimData)

      console.log("Claims chart data (Top 10):", chartData)
      console.log("Faucet rankings (All):", rankingData)

      setData(chartData)
      
      console.log('Claim data saved to both localStorage and Supabase')
      
      if (allClaims.length > 0) {
        toast({
          title: "Data refreshed",
          description: `Loaded ${allClaims.length} total drops`,
        })
      }
    } catch (error) {
      console.error("Error fetching claim data:", error)
      toast({
        title: "Failed to load data",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // UPDATED: loadStoredData to correctly populate faucetNames state from cache/Supabase
  const loadStoredData = async () => {
    // Try localStorage first
    if (isCacheValid()) {
      const cachedClaims = loadFromLocalStorage<ClaimType[]>(STORAGE_KEYS.CLAIMS_DATA)
      if (cachedClaims && cachedClaims.length > 0) {
        console.log('Using cached claims data from localStorage')
        
        // --- LOGIC FOR CACHED DATA PROCESSING ---
        const claimsByFaucet: { [key: string]: { 
            claims: number, 
            network: string,
            chainId: number,
            totalAmount: bigint,
            tokenSymbol: string,
            tokenDecimals: number,
            latestTimestamp: number
        } } = {}

        for (const claim of cachedClaims) {
            const faucetKey = claim.faucet.toLowerCase()
            
            if (!claimsByFaucet[faucetKey]) {
                claimsByFaucet[faucetKey] = { 
                    claims: 0, 
                    network: claim.networkName,
                    chainId: claim.chainId,
                    totalAmount: BigInt(0),
                    tokenSymbol: claim.tokenSymbol,
                    tokenDecimals: claim.tokenDecimals,
                    latestTimestamp: 0
                }
            }
            
            claimsByFaucet[faucetKey].claims += 1
            claimsByFaucet[faucetKey].totalAmount += claim.amount
            
            if (claim.timestamp > claimsByFaucet[faucetKey].latestTimestamp) {
                claimsByFaucet[faucetKey].latestTimestamp = claim.timestamp
            }
        }
        
        // Load cached names separately (CRITICAL FIX)
        const cachedNames = loadFromLocalStorage<Record<string, string>>(STORAGE_KEYS.FAUCET_NAMES) || {};
        
        // Use cached names and data to build rankings/chart data
        const rankingData = Object.entries(claimsByFaucet)
            .sort(([, a], [, b]) => b.latestTimestamp - a.latestTimestamp)
            .map(([faucet, data], index) => {
                const name = cachedNames[faucet] || `Faucet ${faucet.slice(0, 6)}...${faucet.slice(-4)}`;
                return {
                    rank: index + 1,
                    faucetAddress: faucet,
                    faucetName: name,
                    network: data.network,
                    chainId: data.chainId,
                    totalClaims: data.claims,
                    latestClaimTime: data.latestTimestamp,
                    totalAmount: `${Number(formatUnits(data.totalAmount, data.tokenDecimals)).toFixed(4)} ${data.tokenSymbol}`
                }
            })

        const top10Faucets = Object.entries(claimsByFaucet)
            .sort(([, a], [, b]) => b.claims - a.claims)
            .slice(0, 10);
            
        const colors = generateColors(top10Faucets.length);
        
        const chartData: ChartClaimData[] = top10Faucets.map(([faucet, data], index) => ({
            name: cachedNames[faucet] || `${faucet.slice(0, 6)}...${faucet.slice(-4)}`,
            value: data.claims,
            color: colors[index],
            faucetAddress: faucet
        }));

        setFaucetNames(cachedNames); // CRUCIAL: Set the names map
        setFaucetRankings(rankingData);
        setData(chartData);
        setTotalClaims(cachedClaims.length);
        setTotalFaucets(rankingData.length);
        
        setLoading(false)
        return true
      }
    }

    // Fallback to Supabase
    try {
      const supabaseData = await DataService.loadClaimData()
      if (supabaseData.length > 0 && DataService.isDataFresh(supabaseData[0].updated_at)) {
        console.log('Using fresh claim data from Supabase')
        
        // 1. Build the FaucetNames Map from Supabase data (CRITICAL FIX)
        const newFaucetNames: Record<string, string> = {};
        supabaseData.forEach(item => {
            newFaucetNames[item.faucet_address] = item.faucet_name;
        });

        // 2. Set the state before generating chart/ranking data
        setFaucetNames(newFaucetNames); // CRUCIAL: Set the names map
        
        const chartData = supabaseData.slice(0, 10).map((item, index) => ({
          name: item.faucet_name, // Name comes directly from Supabase
          value: item.claims,
          color: `hsl(${(index * 137.508) % 360}, 70%, 60%)`,
          faucetAddress: item.faucet_address
        }))
        
        const rankingData = supabaseData.map((item, index) => ({
          rank: index + 1,
          faucetAddress: item.faucet_address,
          faucetName: item.faucet_name, // Name comes directly from Supabase
          network: item.network,
          chainId: item.chain_id,
          totalClaims: item.claims,
          latestClaimTime: item.latest_claim_time,
          totalAmount: item.total_amount
        }))
        
        const totalClaimsCount = supabaseData.reduce((sum, item) => sum + item.claims, 0)
        
        setData(chartData)
        setFaucetRankings(rankingData)
        setTotalClaims(totalClaimsCount)
        setTotalFaucets(supabaseData.length)
        
        setLoading(false)
        return true
      }
    } catch (error) {
      console.error('Error loading claim data from Supabase:', error)
    }

    return false
}


  useEffect(() => {
    loadStoredData().then((dataLoaded) => {
      if (!dataLoaded && networks.length > 0) {
        fetchAndStoreData()
      }
    })
  }, [networks])

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    if (networks.length === 0) return

    const interval = setInterval(() => {
      fetchAndStoreData()
    }, CACHE_DURATION)

    return () => clearInterval(interval)
  }, [networks])

  const getNetworkColor = (network: string) => {
    switch (network.toLowerCase()) {
      case 'celo':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'arbitrum':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'base':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'lisk':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  // Helper function to get the explorer URL for a given chainId
  const getExplorerUrl = (chainId: number, address: string) => {
    const chainConfig = CHAIN_CONFIGS[chainId]
    if (chainConfig?.blockExplorerUrlsUrls?.length > 0) {
      return `${chainConfig.blockExplorerUrlsUrls[0]}/address/${address}`
    }
    return '#'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-sm md:text-base">Loading faucet data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Custom tooltip to show faucet details
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="font-medium text-sm md:text-base">{data.name}</p>
          {data.faucetAddress !== 'others' && (
            <p className="text-xs md:text-sm text-muted-foreground">
              Address: {data.faucetAddress.slice(0, 6)}...{data.faucetAddress.slice(-4)}
            </p>
          )}
          <p className="text-xs md:text-sm">
            Drops: <span className="font-medium">{data.value.toLocaleString()}</span>
          </p>
          <p className="text-xs md:text-sm text-muted-foreground">
            {((data.value / totalClaims) * 100).toFixed(1)}% of total drops
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4 md:space-y-6 p-2 md:p-4">
      {/* Header Section with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-grow">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-lg md:text-2xl font-bold">{totalClaims.toLocaleString()}</p>
            <p className="text-xs md:text-sm text-muted-foreground">Total Drops</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAndStoreData} disabled={loading} className="shrink-0">
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline ml-2">Refresh</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {/* Pie Chart - Top 10 Only */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg md:text-xl">Top 10 Faucets by Drops</CardTitle>
            <CardDescription className="text-sm">
              Distribution of drops among top 10 most active faucets
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} className="md:h-96">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius="80%"
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p className="text-sm md:text-base">No drop data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Available Faucets Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg md:text-xl">All Available Faucets</CardTitle>
            <CardDescription className="text-sm">
              Complete list ranked by latest activity from all active faucets
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="w-16 text-xs md:text-sm font-medium text-left p-2 md:p-4">Rank</th>
                    <th className="text-xs md:text-sm font-medium text-left p-2 md:p-4">Faucet Name</th>
                    <th className="text-xs md:text-sm font-medium text-left p-2 md:p-4">Network</th>
                    <th className="text-right text-xs md:text-sm font-medium p-2 md:p-4">Drops</th>
                    <th className="text-right text-xs md:text-sm font-medium p-2 md:p-4">Latest</th>
                  </tr>
                </thead>
                <tbody>
                  {faucetRankings.length > 0 ? (
                    faucetRankings.map((item) => (
                      <tr key={item.faucetAddress} className="border-b hover:bg-muted/50">
                        <td className="font-medium p-2 md:p-4">
                          <span className="text-sm font-medium text-muted-foreground">#{item.rank}</span>
                        </td>
                        <td className="p-2 md:p-4">
                          <div className="max-w-[150px] md:max-w-[200px]">
                            <div className="font-medium truncate mb-1 text-xs md:text-sm" title={item.faucetName}>
                              {item.faucetName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.faucetAddress.slice(0, 6)}...{item.faucetAddress.slice(-4)} 
                              <a
                                href={getExplorerUrl(item.chainId, item.faucetAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline ml-1"
                              > 
                                <ExternalLink className="h-3 w-3 inline" />
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 md:p-4">
                          <Badge variant="secondary" className={`${getNetworkColor(item.network)} text-xs`}>
                            {item.network}
                          </Badge>
                        </td>
                        <td className="text-right font-medium text-xs md:text-sm p-2 md:p-4">
                          {item.totalClaims.toLocaleString()}
                        </td>
                        <td className="text-right text-xs p-2 md:p-4">
                          {new Date(item.latestClaimTime * 1000).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground p-2 md:p-4">
                        <p className="text-sm">No faucet data available yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}