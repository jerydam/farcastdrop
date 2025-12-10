"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Contract, JsonRpcProvider, isAddress } from "ethers"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNetwork } from "@/hooks/use-network"
import { getAllClaimsForAllNetworks } from "@/lib/faucet"
import { DataService, UserData } from "@/lib/database-helpers"
import { FACTORY_ABI } from "@/lib/abis"

// Default baseline data - historical user data
const DEFAULT_USER_DATA: ChartUserData[] = [   					
{date: "2025-06-21", newUsers: 22, cumulativeUsers: 22},

{date: "2025-06-22", newUsers: 1, cumulativeUsers: 23},

{date: "2025-06-23", newUsers: 1, cumulativeUsers: 24},

{date: "2025-07-01", newUsers: 4, cumulativeUsers: 28},

{date: "2025-07-03", newUsers: 36, cumulativeUsers: 64},

{date: "2025-07-11", newUsers: 5, cumulativeUsers: 69},
 
{date: "2025-07-22", newUsers: 2, cumulativeUsers: 71},

{date: "2025-07-23", newUsers: 4, cumulativeUsers: 75},

{date: "2025-07-24", newUsers: 7, cumulativeUsers: 82},

{date: "2025-07-25", newUsers: 19, cumulativeUsers: 101},

{date: "2025-07-26", newUsers: 24, cumulativeUsers: 125},

{date: "2025-07-29", newUsers: 6, cumulativeUsers: 131},

{date: "2025-07-30", newUsers: 1, cumulativeUsers: 132},

{date: "2025-08-01", newUsers: 11, cumulativeUsers: 143},

{date: "2025-08-08", newUsers: 2, cumulativeUsers: 145},
 
{date: "2025-08-13", newUsers: 1, cumulativeUsers: 146},
 
{date: "2025-08-25", newUsers: 1, cumulativeUsers: 147},
 
{date: "2025-08-27", newUsers: 173, cumulativeUsers: 320},
 
{date: "2025-08-30", newUsers: 22, cumulativeUsers: 342},
 
{date: "2025-09-08", newUsers: 30, cumulativeUsers: 372},
 
{date: "2025-09-13", newUsers: 87, cumulativeUsers: 459},
 
{date: "2025-09-15", newUsers: 76, cumulativeUsers: 535},
 
{date: "2025-09-16", newUsers: 19, cumulativeUsers: 554},
 
{date: "2025-09-17", newUsers: 56, cumulativeUsers: 610},
 
{date: "2025-09-18", newUsers: 4, cumulativeUsers: 614},
 
{date: "2025-09-19", newUsers: 34, cumulativeUsers: 648},
 
{date: "2025-09-20", newUsers: 1, cumulativeUsers: 649},
 
{date: "2025-09-22", newUsers: 28, cumulativeUsers: 677},
 
{date: "2025-09-23", newUsers: 2, cumulativeUsers: 679},
 
{date: "2025-09-30", newUsers: 1, cumulativeUsers: 680},
 
{date: "2025-10-02", newUsers: 32, cumulativeUsers: 712},
 
{date: "2025-10-06", newUsers: 13, cumulativeUsers: 725},
 
{date: "2025-10-11", newUsers: 2, cumulativeUsers: 727},
 
{date: "2025-10-12", newUsers: 1, cumulativeUsers: 728},
 
{date: "2025-10-16", newUsers: 1, cumulativeUsers: 729},
 
{date: "2025-10-17", newUsers: 13, cumulativeUsers: 742},
 
{date: "2025-10-18", newUsers: 1, cumulativeUsers: 743},
 
{date: "2025-10-19", newUsers: 4, cumulativeUsers: 747},
 
{date: "2025-10-20", newUsers: 10, cumulativeUsers: 757},
 
{date: "2025-10-24", newUsers: 2, cumulativeUsers: 759},
 
{date: "2025-10-31", newUsers: 2, cumulativeUsers: 761},
 
{date: "2025-11-01", newUsers: 6, cumulativeUsers: 767},
 
{date: "2025-11-08", newUsers: 385, cumulativeUsers: 1152},
 
{date: "2025-11-09", newUsers: 148, cumulativeUsers: 1300},
 
{date: "2025-11-10", newUsers: 39, cumulativeUsers: 1339},
 
{date: "2025-11-12", newUsers: 2, cumulativeUsers: 1341},
 
{date: "2025-11-13", newUsers: 3, cumulativeUsers: 1344},
 
{date: "2025-11-15", newUsers: 1, cumulativeUsers: 1345},
 
{date: "2025-11-20", newUsers: 60, cumulativeUsers: 1405},
 
{date: "2025-11-21", newUsers: 1, cumulativeUsers: 1406}
  ];

// Get the latest cumulative users from default data
const DEFAULT_TOTAL_USERS = DEFAULT_USER_DATA[DEFAULT_USER_DATA.length - 1].cumulativeUsers;

// Cache keys for unique users data
const UNIQUE_USERS_STORAGE_KEYS = {
  USERS_DATA: 'unique_users_data',
  CHART_DATA: 'users_chart_data',
  LAST_UPDATED: 'users_last_updated',
  TOTAL_USERS: 'total_unique_users',
};

// Cache duration (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Helper functions for localStorage
function saveToLocalStorage(key: string, data: any) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data, (k, v) => 
        typeof v === 'bigint' ? v.toString() : v
      ));
    }
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
}

function loadFromLocalStorage<T>(key: string): T | null {
  try {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(key);
      if (!data) return null;
      
      return JSON.parse(data, (k, v) => {
        if (k === 'amount' && typeof v === 'string' && /^\d+$/.test(v)) {
          return BigInt(v);
        }
        return v;
      });
    }
    return null;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return null;
  }
}

function isCacheValid(): boolean {
  const lastUpdated = loadFromLocalStorage<number>(UNIQUE_USERS_STORAGE_KEYS.LAST_UPDATED);
  if (!lastUpdated) return false;
  
  return Date.now() - lastUpdated < CACHE_DURATION;
}

// Function to get all claims from factories
async function getAllClaimsFromAllFactories(networks: any[]): Promise<{
  faucetAddress: string
  transactionType: string
  initiator: string
  amount: bigint
  isEther: boolean
  timestamp: number
  networkName: string
  chainId: number
}[]> {
  const allClaims: any[] = [];
  for (const network of networks) {
    try {
      console.log(`Fetching claims from factories on ${network.name}...`);
      
      const provider = new JsonRpcProvider(network.rpcUrl);
      const { transactions } = await getAllClaimsFromFactories(provider, network);
      
      const networkClaims = transactions.map(claim => ({
        ...claim,
        networkName: network.name,
        chainId: network.chainId
      }));
      
      allClaims.push(...networkClaims);
      console.log(`Added ${networkClaims.length} claims from ${network.name}`);
    } catch (error) {
      console.error(`Error fetching claims from ${network.name}:`, error);
    }
  }
  allClaims.sort((a, b) => b.timestamp - a.timestamp);
  return allClaims;
}

// Helper function to get claims from factories for a single network
async function getAllClaimsFromFactories(
  provider: JsonRpcProvider,
  network: any,
): Promise<{
  transactions: {
    faucetAddress: string
    transactionType: string
    initiator: string
    amount: bigint
    isEther: boolean
    timestamp: number
  }[]
  totalClaims: number
  claimsByFaucet: Record<string, number>
}> {
  try {
    let allClaims: any[] = [];
    for (const factoryAddress of network.factoryAddresses) {
      if (!isAddress(factoryAddress)) {
        console.warn(`Invalid factory address ${factoryAddress} on ${network.name}, skipping`);
        continue;
      }
      const factoryContract = new Contract(factoryAddress, FACTORY_ABI, provider);
      const code = await provider.getCode(factoryAddress);
      if (code === "0x") {
        console.warn(`No contract at factory address ${factoryAddress} on ${network.name}`);
        continue;
      }
      try {
        console.log(`Fetching transactions from factory ${factoryAddress}...`);
        const allTransactions = await factoryContract.getAllTransactions();
        
        const claimTransactions = allTransactions.filter((tx: any) => 
          tx.transactionType.toLowerCase().includes('claim')
        );
        
        console.log(`Found ${claimTransactions.length} claim transactions from factory ${factoryAddress}`);
        allClaims.push(...claimTransactions);
      } catch (error) {
        console.warn(`Error fetching transactions from factory ${factoryAddress}:`, error);
      }
    }
    const mappedClaims = allClaims.map((tx: any) => ({
      faucetAddress: tx.faucetAddress as string,
      transactionType: tx.transactionType as string,
      initiator: tx.initiator as string,
      amount: BigInt(tx.amount),
      isEther: tx.isEther as boolean,
      timestamp: Number(tx.timestamp),
    }));
    const claimsByFaucet: Record<string, number> = {};
    mappedClaims.forEach(claim => {
      const faucetAddress = claim.faucetAddress.toLowerCase();
      claimsByFaucet[faucetAddress] = (claimsByFaucet[faucetAddress] || 0) + 1;
    });
    const result = {
      transactions: mappedClaims,
      totalClaims: mappedClaims.length,
      claimsByFaucet
    };
    console.log(`Total claims fetched from ${network.name} factories: ${result.totalClaims}`);
    return result;
  } catch (error: any) {
    console.error(`Error fetching claims from factories on ${network.name}:`, error);
    throw new Error(error.message || "Failed to fetch claims from factories");
  }
}

interface ChartUserData {
  date: string
  newUsers: number
  cumulativeUsers: number
}

// Function to merge default data with fresh data
function mergeUserData(defaultData: ChartUserData[], freshData: ChartUserData[]): ChartUserData[] {
  if (freshData.length === 0) {
    return defaultData;
  }

  // Create a map of dates from fresh data
  const freshDataMap = new Map(freshData.map(item => [item.date, item]));
  
  // Get the last date from default data and first date from fresh data
  const lastDefaultDate = defaultData[defaultData.length - 1].date;
  const firstFreshDate = freshData[0].date;
  
  // If fresh data starts after default data, merge them
  if (firstFreshDate > lastDefaultDate) {
    // Use default data up to the last date, then append fresh data
    return [...defaultData, ...freshData];
  }
  
  // If there's overlap, use fresh data and fill in any gaps from default data
  const mergedMap = new Map<string, ChartUserData>();
  
  // Start with default data
  defaultData.forEach(item => {
    mergedMap.set(item.date, item);
  });
  
  // Override with fresh data
  freshData.forEach(item => {
    mergedMap.set(item.date, item);
  });
  
  // Convert back to array and sort by date
  const merged = Array.from(mergedMap.values()).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Recalculate cumulative users to ensure consistency
  let cumulative = 0;
  return merged.map(item => {
    cumulative += item.newUsers;
    return {
      ...item,
      cumulativeUsers: cumulative
    };
  });
}

// Function to process and cache unique users data
function processAndStoreUsersData(allClaimsUnified: any[]): {
  chartData: ChartUserData[]
  totalUniqueUsers: number
  totalClaims: number
} {
  console.log(`Processing ${allClaimsUnified.length} unified claims for users data...`);
  const uniqueClaimers = new Set<string>();
  const userFirstClaimDate: { [user: string]: string } = {};
  const newUsersByDate: { [date: string]: Set<string> } = {};
  const allClaimsCount = allClaimsUnified.length;

  // Process all unified claims to find first claim date for each user
  for (const claim of allClaimsUnified) {
    const claimer = claim.claimer || claim.initiator;
    if (claimer && typeof claimer === 'string' && claimer.startsWith('0x')) {
      const claimerLower = claimer.toLowerCase();
      uniqueClaimers.add(claimerLower);
      
      // Convert timestamp to date
      const date = new Date(Number(claim.timestamp) * 1000).toISOString().split('T')[0];
      
      // Track the first date this user made a claim
      if (!userFirstClaimDate[claimerLower] || date < userFirstClaimDate[claimerLower]) {
        userFirstClaimDate[claimerLower] = date;
      }
    }
  }

  // Group users by their first claim date
  for (const [user, firstDate] of Object.entries(userFirstClaimDate)) {
    if (!newUsersByDate[firstDate]) {
      newUsersByDate[firstDate] = new Set();
    }
    newUsersByDate[firstDate].add(user);
  }

  // Convert to chart data format and sort by date
  const sortedDates = Object.keys(newUsersByDate).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  let cumulativeUsers = 0;
  const chartData: ChartUserData[] = sortedDates.map(date => {
    const newUsersCount = newUsersByDate[date].size;
    cumulativeUsers += newUsersCount;
    
    return {
      date,
      newUsers: newUsersCount,
      cumulativeUsers: cumulativeUsers
    };
  });

  const totalUniqueUsers = uniqueClaimers.size;

  // Merge with default data
  const mergedData = mergeUserData(DEFAULT_USER_DATA, chartData);
  const finalTotalUsers = mergedData[mergedData.length - 1].cumulativeUsers;

  // Cache in localStorage
  saveToLocalStorage(UNIQUE_USERS_STORAGE_KEYS.CHART_DATA, mergedData);
  saveToLocalStorage(UNIQUE_USERS_STORAGE_KEYS.TOTAL_USERS, finalTotalUsers);
  saveToLocalStorage("total_claim", allClaimsCount);
  saveToLocalStorage(UNIQUE_USERS_STORAGE_KEYS.USERS_DATA, Array.from(uniqueClaimers));
  saveToLocalStorage(UNIQUE_USERS_STORAGE_KEYS.LAST_UPDATED, Date.now());

  console.log("Cached users data:", {
    totalClaims: allClaimsCount,
    totalUniqueUsers: finalTotalUsers,
    chartDataPoints: mergedData.length
  });

  return {
    chartData: mergedData,
    totalUniqueUsers: finalTotalUsers,
    totalClaims: allClaimsCount
  };
}

export function NewUsersChart() {
  const { networks } = useNetwork()
  const [data, setData] = useState<ChartUserData[]>(DEFAULT_USER_DATA)
  const [loading, setLoading] = useState(false) // Start with default data, so not loading initially
  const [totalNewUsers, setTotalNewUsers] = useState(DEFAULT_TOTAL_USERS)
 
  const fetchAndStoreData = async (forceRefresh = false) => {
    setLoading(true)
    try {
      console.log("Fetching fresh claims data for users analysis...");
      
      // Fetch claims from storage (existing method)
      const storageClaims = await getAllClaimsForAllNetworks(networks);
      console.log("Fetched storage claims:", storageClaims.length);
      
      // Fetch claims from factories (new method)
      const factoryClaims = await getAllClaimsFromAllFactories(networks);
      console.log("Fetched factory claims:", factoryClaims.length);
      
      // Convert all claims to unified format
      const allClaimsUnified = [
        // Storage claims
        ...storageClaims.map(claim => ({
          claimer: claim.claimer,
          timestamp: claim.timestamp,
          networkName: claim.networkName,
        })),
        // Factory claims
        ...factoryClaims.map(claim => ({
          claimer: claim.initiator,
          timestamp: claim.timestamp,
          networkName: claim.networkName,
        }))
      ];
      console.log(`Total unified claims: ${allClaimsUnified.length}`);

      // Process and cache the data
      const { chartData, totalUniqueUsers, totalClaims: totalClaimsCount } = processAndStoreUsersData(allClaimsUnified);
      
      // Save to Supabase
      const supabaseData: Omit<UserData, 'id' | 'updated_at'>[] = chartData.map(item => ({
        date: item.date,
        new_users: item.newUsers,
        cumulative_users: item.cumulativeUsers
      }));
      await DataService.saveUserData(supabaseData);

      console.log("Users analysis complete:", {
        totalClaims: totalClaimsCount,
        totalUniqueUsers: totalUniqueUsers,
        chartDataPoints: chartData.length
      });
      
      setData(chartData);
      setTotalNewUsers(totalUniqueUsers);
      
      console.log('User data saved to both localStorage and Supabase');
    } catch (error) {
      console.error("Error fetching claimer data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStoredData = async () => {
    // Try localStorage first
    if (isCacheValid()) {
      const cachedData = loadFromLocalStorage<ChartUserData[]>(UNIQUE_USERS_STORAGE_KEYS.CHART_DATA);
      const cachedTotal = loadFromLocalStorage<number>(UNIQUE_USERS_STORAGE_KEYS.TOTAL_USERS);
      if (cachedData && cachedTotal && cachedData.length > 0) {
        console.log('Using cached users data from localStorage');
        setData(cachedData);
        setTotalNewUsers(cachedTotal);
        return true;
      }
    }

    // Fallback to Supabase
    try {
      const supabaseData = await DataService.loadUserData();
      if (supabaseData.length > 0 && DataService.isDataFresh(supabaseData[0].updated_at)) {
        console.log('Using fresh user data from Supabase');
        const chartData = supabaseData.map(item => ({
          date: item.date,
          newUsers: item.new_users,
          cumulativeUsers: item.cumulative_users
        }));
        const totalUsers = Math.max(...chartData.map(d => d.cumulativeUsers));
        
        setData(chartData);
        setTotalNewUsers(totalUsers);
        
        // Cache in localStorage
        saveToLocalStorage(UNIQUE_USERS_STORAGE_KEYS.CHART_DATA, chartData);
        saveToLocalStorage(UNIQUE_USERS_STORAGE_KEYS.TOTAL_USERS, totalUsers);
        saveToLocalStorage(UNIQUE_USERS_STORAGE_KEYS.LAST_UPDATED, Date.now());
        
        return true;
      }
    } catch (error) {
      console.error('Error loading user data from Supabase:', error);
    }

    return false;
  };

  useEffect(() => {
    // Load stored data in the background, but show default data immediately
    loadStoredData().then((dataLoaded) => {
      // If no cached or Supabase data was loaded, fetch fresh data
      if (!dataLoaded && networks.length > 0) {
        fetchAndStoreData();
      }
    });
  }, [networks]);

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    if (networks.length === 0) return;
    
    const interval = setInterval(() => {
      fetchAndStoreData();
    }, CACHE_DURATION);

    return () => clearInterval(interval);
  }, [networks]);

  // Custom tooltip to show both new and cumulative users
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{new Date(label).toLocaleDateString()}</p>
          <p className="text-sm text-blue-600">
            New Users: <span className="font-medium">{data.newUsers}</span>
          </p>
          <p className="text-sm text-green-600">
            Total Users: <span className="font-medium">{data.cumulativeUsers}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{totalNewUsers.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Unique Users</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchAndStoreData(true)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="newUsers" 
              fill="#0052FF" 
              name="New Users"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No user data available
        </div>
      )}
    </div>
  )
}