"use client"

import { useEffect, useState, useCallback } from "react"
import { Contract, JsonRpcProvider, isAddress } from "ethers"
import { useNetwork } from "@/hooks/use-network"
import { FACTORY_ABI } from "@/lib/abis"
import { Loader2, Activity, RefreshCw, History, Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

// Cache keys for transaction data
const TRANSACTION_STORAGE_KEYS = {
  NETWORK_STATS: 'transaction_network_stats',
  ALL_TRANSACTIONS: 'transaction_all_transactions',
  TOTAL_TRANSACTIONS: 'transaction_total_count',
  LAST_UPDATED: 'transaction_last_updated',
  HISTORY: 'transaction_history',
  VERSION: 'transaction_version'
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
  const lastUpdated = loadFromLocalStorage<number>(TRANSACTION_STORAGE_KEYS.LAST_UPDATED);
  return lastUpdated ? Date.now() - lastUpdated < CACHE_DURATION : false;
}

interface NetworkStats {
  name: string
  chainId: number
  totalTransactions: number
  color: string
  factoryAddresses: string[]
  rpcUrl: string
}

interface TransactionData {
  faucetAddress: string
  transactionType: string
  initiator: string
  amount: bigint
  isEther: boolean
  timestamp: number
  networkName: string
  chainId: number
  txHash?: string
  blockNumber?: number
}

interface StoredTransactionHistory {
  timestamp: number
  networkStats: NetworkStats[]
  totalTransactions: number
  allTransactions: TransactionData[]
  fetchedAt: string
}

interface TransactionStorage {
  history: StoredTransactionHistory[]
  lastUpdated: number
  version: string
}

const NETWORK_COLORS: Record<string, string> = {
  "Celo": "#35D07F",
  "Lisk": "#0D4477", 
  "Base": "#0052FF",
  "Arbitrum": "#28A0F0",
  "Ethereum": "#627EEA",
  "Polygon": "#8247E5",
  "Optimism": "#FF0420",
  "default": "#6B7280"
}

async function getAllTransactionsFromNetwork(
  provider: JsonRpcProvider,
  network: any
): Promise<{
  transactions: TransactionData[]
  totalTransactions: number
}> {
  try {
    let allTransactions: any[] = [];

    if (network.factoryAddresses && network.factoryAddresses.length > 0) {
      for (const factoryAddress of network.factoryAddresses) {
        if (!isAddress(factoryAddress)) {
          console.warn(`Invalid factory address ${factoryAddress} on ${network.name}, skipping`);
          continue;
        }

        const code = await provider.getCode(factoryAddress);
        if (code === "0x") {
          console.warn(`No contract at factory address ${factoryAddress} on ${network.name}`);
          continue;
        }

        const factoryContract = new Contract(factoryAddress, FACTORY_ABI, provider);

        try {
          console.log(`Fetching transactions from factory ${factoryAddress} on ${network.name}...`);
          
          let transactions;
          try {
            transactions = await factoryContract.getAllTransactions();
          } catch (error) {
            try {
              const totalCount = await factoryContract.getTotalTransactions();
              console.log(`Factory ${factoryAddress} has ${totalCount} total transactions (count only)`);
              transactions = Array(Number(totalCount)).fill(null).map((_, index) => ({
                faucetAddress: factoryAddress,
                transactionType: "unknown",
                initiator: "0x0000000000000000000000000000000000000000",
                amount: BigInt(0),
                isEther: false,
                timestamp: Math.floor(Date.now() / 1000) - index * 60
              }));
            } catch (fallbackError) {
              console.warn(`No transaction methods available for factory ${factoryAddress}:`, fallbackError);
              continue;
            }
          }
          
          console.log(`Found ${transactions.length} transactions from factory ${factoryAddress}`);
          allTransactions.push(...transactions);
        } catch (error) {
          console.warn(`Error fetching transactions from factory ${factoryAddress}:`, error);
        }
      }
    } else {
      console.log(`No factory addresses configured for ${network.name}`);
    }

    const mappedTransactions: TransactionData[] = allTransactions.map((tx: any) => ({
      faucetAddress: tx.faucetAddress || "unknown",
      transactionType: tx.transactionType || "unknown",
      initiator: tx.initiator || "0x0000000000000000000000000000000000000000",
      amount: typeof tx.amount === 'bigint' ? tx.amount : BigInt(tx.amount || 0),
      isEther: tx.isEther || false,
      timestamp: Number(tx.timestamp) || Math.floor(Date.now() / 1000),
      networkName: network.name,
      chainId: network.chainId,
      txHash: tx.txHash,
      blockNumber: tx.blockNumber
    }));

    const result = {
      transactions: mappedTransactions,
      totalTransactions: mappedTransactions.length
    };

    console.log(`Total transactions fetched from ${network.name}: ${result.totalTransactions}`);
    return result;
  } catch (error: any) {
    console.error(`Error fetching transactions from ${network.name}:`, error);
    return {
      transactions: [],
      totalTransactions: 0
    };
  }
}

async function getAllTransactionsFromAllNetworks(networks: any[]): Promise<{
  allTransactions: TransactionData[]
  networkStats: NetworkStats[]
  totalTransactions: number
}> {
  const allTransactions: TransactionData[] = [];
  const networkStats: NetworkStats[] = [];
  let totalTransactions = 0;

  for (const network of networks) {
    try {
      console.log(`Fetching transactions from ${network.name}...`);
      
      const provider = new JsonRpcProvider(network.rpcUrl);
      const { transactions, totalTransactions: networkTotal } = await getAllTransactionsFromNetwork(provider, network);
      
      allTransactions.push(...transactions);
      totalTransactions += networkTotal;
      
      networkStats.push({
        name: network.name,
        chainId: network.chainId,
        totalTransactions: networkTotal,
        color: NETWORK_COLORS[network.name] || NETWORK_COLORS.default,
        factoryAddresses: network.factoryAddresses || [],
        rpcUrl: network.rpcUrl
      });
      
      console.log(`Added ${networkTotal} transactions from ${network.name}`);
    } catch (error) {
      console.error(`Error processing ${network.name}:`, error);
      
      networkStats.push({
        name: network.name,
        chainId: network.chainId,
        totalTransactions: 0,
        color: NETWORK_COLORS[network.name] || NETWORK_COLORS.default,
        factoryAddresses: network.factoryAddresses || [],
        rpcUrl: network.rpcUrl
      });
    }
  }

  networkStats.sort((a, b) => b.totalTransactions - a.totalTransactions);

  return {
    allTransactions,
    networkStats,
    totalTransactions
  };
}

export function TransactionsPerDayChart() {
  const { networks } = useNetwork()
  const [networkStats, setNetworkStats] = useState<NetworkStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [allTransactions, setAllTransactions] = useState<TransactionData[]>([])
  
  const [transactionStorage, setTransactionStorage] = useState<TransactionStorage>({
    history: [],
    lastUpdated: 0,
    version: "1.0.0"
  })
  const [showHistory, setShowHistory] = useState(false)

  const saveToStorage = useCallback((
    networkStats: NetworkStats[], 
    totalTransactions: number, 
    allTransactions: TransactionData[]
  ) => {
    const newEntry: StoredTransactionHistory = {
      timestamp: Date.now(),
      networkStats,
      totalTransactions,
      allTransactions,
      fetchedAt: new Date().toISOString()
    }

    setTransactionStorage(prev => {
      const newHistory = [...prev.history, newEntry]
      const trimmedHistory = newHistory.slice(-50)
      
      saveToLocalStorage(TRANSACTION_STORAGE_KEYS.HISTORY, trimmedHistory)
      saveToLocalStorage(TRANSACTION_STORAGE_KEYS.NETWORK_STATS, networkStats)
      saveToLocalStorage(TRANSACTION_STORAGE_KEYS.ALL_TRANSACTIONS, allTransactions)
      saveToLocalStorage(TRANSACTION_STORAGE_KEYS.TOTAL_TRANSACTIONS, totalTransactions)
      saveToLocalStorage(TRANSACTION_STORAGE_KEYS.LAST_UPDATED, Date.now())
      saveToLocalStorage(TRANSACTION_STORAGE_KEYS.VERSION, prev.version)
      
      return {
        ...prev,
        history: trimmedHistory,
        lastUpdated: Date.now()
      }
    })
  }, [])

  const loadFromHistory = useCallback((entry: StoredTransactionHistory) => {
    setNetworkStats(entry.networkStats)
    setTotalTransactions(entry.totalTransactions)
    setAllTransactions(entry.allTransactions)
  }, [])

  const exportData = useCallback(() => {
    const dataStr = JSON.stringify(transactionStorage, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString()
      }
      return value
    }, 2)
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transaction-history-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [transactionStorage])

  const importData = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string)
        const processedData = {
          ...importedData,
          history: importedData.history.map((entry: any) => ({
            ...entry,
            allTransactions: entry.allTransactions.map((tx: any) => ({
              ...tx,
              amount: BigInt(tx.amount)
            }))
          }))
        }
        setTransactionStorage(processedData)
        saveToLocalStorage(TRANSACTION_STORAGE_KEYS.HISTORY, processedData.history)
        saveToLocalStorage(TRANSACTION_STORAGE_KEYS.VERSION, processedData.version)
        console.log('Transaction history imported successfully')
      } catch (error) {
        console.error('Error importing transaction history:', error)
      }
    }
    reader.readAsText(file)
  }, [])

  const fetchTransactions = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      if (!isRefresh && isCacheValid()) {
        const cachedNetworkStats = loadFromLocalStorage<NetworkStats[]>(TRANSACTION_STORAGE_KEYS.NETWORK_STATS)
        const cachedAllTransactions = loadFromLocalStorage<TransactionData[]>(TRANSACTION_STORAGE_KEYS.ALL_TRANSACTIONS)
        const cachedTotal = loadFromLocalStorage<number>(TRANSACTION_STORAGE_KEYS.TOTAL_TRANSACTIONS)
        const cachedHistory = loadFromLocalStorage<StoredTransactionHistory[]>(TRANSACTION_STORAGE_KEYS.HISTORY)
        
        if (cachedNetworkStats && cachedAllTransactions && cachedTotal !== null && cachedHistory) {
          console.log('Using cached transaction data')
          setNetworkStats(cachedNetworkStats)
          setAllTransactions(cachedAllTransactions)
          setTotalTransactions(cachedTotal)
          setTransactionStorage({
            history: cachedHistory,
            lastUpdated: loadFromLocalStorage<number>(TRANSACTION_STORAGE_KEYS.LAST_UPDATED) || 0,
            version: loadFromLocalStorage<string>(TRANSACTION_STORAGE_KEYS.VERSION) || "1.0.0"
          })
          setLoading(false)
          return
        }
      }

      console.log("Fetching transactions from all networks...");
      
      const {
        allTransactions: fetchedTransactions,
        networkStats: fetchedStats,
        totalTransactions: total
      } = await getAllTransactionsFromAllNetworks(networks);

      setAllTransactions(fetchedTransactions);
      setNetworkStats(fetchedStats);
      setTotalTransactions(total);
      
      saveToStorage(fetchedStats, total, fetchedTransactions);
      
      console.log(`Total transactions across all networks: ${total}`);
      console.log("Network breakdown:", fetchedStats.map(s => `${s.name}: ${s.totalTransactions}`).join(", "));
      
    } catch (error) {
      console.error("Error fetching transactions:", error);
      const cachedNetworkStats = loadFromLocalStorage<NetworkStats[]>(TRANSACTION_STORAGE_KEYS.NETWORK_STATS)
      const cachedAllTransactions = loadFromLocalStorage<TransactionData[]>(TRANSACTION_STORAGE_KEYS.ALL_TRANSACTIONS)
      const cachedTotal = loadFromLocalStorage<number>(TRANSACTION_STORAGE_KEYS.TOTAL_TRANSACTIONS)
      const cachedHistory = loadFromLocalStorage<StoredTransactionHistory[]>(TRANSACTION_STORAGE_KEYS.HISTORY)
      
      if (cachedNetworkStats && cachedAllTransactions && cachedTotal !== null && cachedHistory) {
        console.log('Using cached transaction data as fallback')
        setNetworkStats(cachedNetworkStats)
        setAllTransactions(cachedAllTransactions)
        setTotalTransactions(cachedTotal)
        setTransactionStorage({
          history: cachedHistory,
          lastUpdated: loadFromLocalStorage<number>(TRANSACTION_STORAGE_KEYS.LAST_UPDATED) || 0,
          version: loadFromLocalStorage<string>(TRANSACTION_STORAGE_KEYS.VERSION) || "1.0.0"
        })
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const cachedNetworkStats = loadFromLocalStorage<NetworkStats[]>(TRANSACTION_STORAGE_KEYS.NETWORK_STATS)
    const cachedAllTransactions = loadFromLocalStorage<TransactionData[]>(TRANSACTION_STORAGE_KEYS.ALL_TRANSACTIONS)
    const cachedTotal = loadFromLocalStorage<number>(TRANSACTION_STORAGE_KEYS.TOTAL_TRANSACTIONS)
    const cachedHistory = loadFromLocalStorage<StoredTransactionHistory[]>(TRANSACTION_STORAGE_KEYS.HISTORY)
    
    if (cachedNetworkStats && cachedAllTransactions && cachedTotal !== null && cachedHistory && isCacheValid()) {
      console.log('Loading cached transaction data on mount')
      setNetworkStats(cachedNetworkStats)
      setAllTransactions(cachedAllTransactions)
      setTotalTransactions(cachedTotal)
      setTransactionStorage({
        history: cachedHistory,
        lastUpdated: loadFromLocalStorage<number>(TRANSACTION_STORAGE_KEYS.LAST_UPDATED) || 0,
        version: loadFromLocalStorage<string>(TRANSACTION_STORAGE_KEYS.VERSION) || "1.0.0"
      })
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (networks.length > 0) {
      if (!isCacheValid()) {
        fetchTransactions();
      }
    }
  }, [networks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading transactions from all networks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <p className="text-4xl font-bold text-primary">{totalTransactions.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">
            Total transactions across all networks
          </p>
        </div>
       
      </div>

      {showHistory && (
        <div className="border rounded-lg p-4 bg-card">
          <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
          {transactionStorage.history.length === 0 ? (
            <p className="text-muted-foreground">No historical data available</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {transactionStorage.history.slice().reverse().map((entry, index) => (
                <div
                  key={entry.timestamp}
                  className="flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-muted/50"
                  onClick={() => loadFromHistory(entry)}
                >
                  <div>
                    <p className="font-medium">{entry.totalTransactions.toLocaleString()} transactions</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entry.networkStats.filter(s => s.totalTransactions > 0).length} networks active
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {transactionStorage.history.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date(transactionStorage.lastUpdated).toLocaleString()}
          {transactionStorage.history.length}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {networkStats.map((network) => (
          <div
            key={`${network.name}-${network.chainId}`}
            className="p-4 rounded-lg border bg-card hover:shadow-lg transition-shadow"
            style={{ borderLeftColor: network.color, borderLeftWidth: "4px" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" style={{ color: network.color }} />
                <div>
                  <h3 className="font-semibold">{network.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {network.factoryAddresses.length} factories
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{network.totalTransactions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">transactions</p>
              </div>
            </div>

            <div className="mt-3">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: network.color,
                    width: `${totalTransactions > 0 ? (network.totalTransactions / totalTransactions) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  {totalTransactions > 0 ? ((network.totalTransactions / totalTransactions) * 100).toFixed(1) : 0}% of total
                </p>
                <p className="text-xs text-muted-foreground">
                  Chain ID: {network.chainId}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalTransactions === 0 && !loading && (
        <div className="text-center py-12">
          <Activity className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Transactions Found</h3>
          <p className="text-muted-foreground mb-4">
            No transactions have been recorded across any network yet.
          </p>
          <Button onClick={() => fetchTransactions(true)} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}