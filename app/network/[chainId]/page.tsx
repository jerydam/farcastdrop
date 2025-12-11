"use client"

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { useNetwork, Network } from "@/hooks/use-network"; 
import { useToast } from "@/hooks/use-toast";
import LoadingPage from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// NOTE: These utility functions must be implemented in your lib/faucet.ts
import { getFaucetsForNetwork, getFaucetDetailsFromFactory } from "@/lib/faucet"; 
import { formatUnits, Contract, ZeroAddress, JsonRpcProvider, isAddress } from "ethers"; // Added isAddress
import { Coins, Clock, Search, Filter, SortAsc, X, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/header";
import Link from "next/link";

// --- CONFIGURATION PLACEHOLDERS ---
const FAUCET_FACTORY_ABI = [
  "function getAllFaucets() view returns (address[])",
  "function getFaucetDetails(address faucetAddress) view returns ((address faucetAddress, address owner, string name, uint256 claimAmount, address tokenAddress, uint256 startTime, uint256 endTime, bool isClaimActive, uint256 balance, bool isEther, bool useBackend))",
];

// Fallback ABI to ensure balance fetching works even if @/lib/abis is missing
const MINIMAL_ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

const DEFAULT_FAUCET_IMAGE = "/default.jpeg";

// 🌟 LIGHTWEIGHT STRUCTURE (For sorting/filtering all faucets)
interface FaucetMeta {
  faucetAddress: string;
  isClaimActive: boolean;
  isEther: boolean;
  createdAt?: string | number;
  tokenSymbol?: string;
  name?: string;
  owner?: string;
  factoryAddress: string; 
}

// 🌟 FULL DETAIL STRUCTURE (For rendering the current page)
interface FaucetData {
  faucetAddress: string;
  name?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  isEther: boolean;
  balance?: bigint;
  claimAmount?: bigint;
  startTime?: string | number;
  endTime?: string | number;
  isClaimActive: boolean;
  token?: string;
  network?: Network;
  createdAt?: string | number;
  description?: string;
  imageUrl?: string;
  owner?: string;
  factoryAddress: string;
}

const FILTER_OPTIONS = {
  ALL: 'all',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  NATIVE: 'native',
  ERC20: 'erc20'
} as const;

const SORT_OPTIONS = {
  DEFAULT: 'default', 
  NAME_ASC: 'name_asc',
  NAME_DESC: 'name_desc',
} as const;

type FilterOption = typeof FILTER_OPTIONS[keyof typeof FILTER_OPTIONS];
type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS];

// --- UTILITY FUNCTIONS ---

interface DeletedFaucetResponse {
    success: boolean;
    count: number;
    deletedAddresses: string[];
}

/**
 * Fetches the list of all faucet addresses marked as deleted in the off-chain database.
 */
async function fetchDeletedFaucetsSet(): Promise<Set<string>> {
    try {
        const response = await fetch("https://fauctdrop-backend.onrender.com/deleted-faucets");
        
        if (!response.ok) {
            console.error("Backend failed to return deleted faucet list.");
            return new Set();
        }

        const result: DeletedFaucetResponse = await response.json();
        
        if (result.success && result.deletedAddresses) {
            const deletedSet = new Set(result.deletedAddresses.map(addr => addr.toLowerCase()));
            return deletedSet;
        }
        return new Set();
    } catch (error) {
        console.error("Failed to fetch deleted faucet list from backend:", error);
        return new Set();
    }
}

function useWindowSize() {
  const [windowSize, setWindowSize] = useState<{ width: number; height: number }>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      }, 150);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);
  return windowSize;
}

function usePreviousPage() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => { setCanGoBack(window.history.length > 1); }, []);
  const goBack = useCallback(() => {
    if (canGoBack) { router.back(); } else { router.push('/'); }
  }, [router, canGoBack]);
  return { goBack, canGoBack };
}

const loadFaucetMetadata = async (faucetAddress: string): Promise<{description?: string, imageUrl?: string}> => {
  try {
    const response = await fetch(`https://fauctdrop-backend.onrender.com/faucet-metadata/${faucetAddress}`)
    if (response.ok) {
      const result = await response.json()
      return { description: result.description, imageUrl: result.imageUrl }
    }
  } catch (error) {
    console.warn('Could not load faucet metadata:', error)
  }
  return {}
}

const getNativeTokenSymbol = (networkName: string): string => {
  switch (networkName) {
    case "Celo": return "CELO"
    case "Lisk":
    case "Arbitrum":
    case "Base":
    case "Ethereum": return "ETH"
    case "Polygon": return "MATIC"
    case "Optimism": return "ETH"
    default: return "ETH"
  }
}

const getDefaultDescription = (networkName: string, ownerAddress: string): string => {
  return `This is a faucet on ${networkName} by ${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}`;
}

// --- FIXED TOKEN BALANCE COMPONENT ---
function TokenBalance({ 
  tokenAddress, 
  tokenSymbol, 
  tokenDecimals, 
  isNativeToken, 
  networkChainId 
}: { 
  tokenAddress: string; 
  tokenSymbol: string; 
  tokenDecimals: number; 
  isNativeToken: boolean; 
  networkChainId: number; 
}) {
  const { provider, address } = useWallet();
  const [balance, setBalance] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let isMounted = true;
    const fetchBalance = async () => {
      // 1. Safety Checks
      if (!provider || !address) { 
        if (isMounted) setLoading(false); 
        return; 
      }

      // 2. Validate Address Format
      // If it's not native and not the ZeroAddress, it must be a valid Ethereum address
      if (!isNativeToken && tokenAddress !== ZeroAddress && !isAddress(tokenAddress)) {
        console.error(`Invalid token address detected: ${tokenAddress}`);
        if (isMounted) {
            setBalance("Err");
            setLoading(false);
        }
        return;
      }

      try {
        if (isMounted) setLoading(true);
        let rawBalance: bigint;

        if (isNativeToken) {
           rawBalance = await provider.getBalance(address);
        } 
        else if (tokenAddress === ZeroAddress) {
           rawBalance = BigInt(0);
        } 
        else {
           // Use MINIMAL_ERC20_ABI to guarantee compatibility
           const tokenContract = new Contract(tokenAddress, MINIMAL_ERC20_ABI, provider);
           rawBalance = await tokenContract.balanceOf(address);
        }

        if (isMounted) {
          const formattedBalance = Number(formatUnits(rawBalance, tokenDecimals)).toFixed(4);
          setBalance(formattedBalance);
        }
      } catch (error: any) {
        console.error("Error fetching balance:", { token: tokenSymbol, error: error.message });
        if (isMounted) setBalance("-");
      } finally { 
        if (isMounted) setLoading(false); 
      }
    };

    fetchBalance();

    return () => { isMounted = false; };
  }, [provider, address, tokenAddress, tokenDecimals, isNativeToken, networkChainId]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-2 sm:p-3 md:p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <span className="text-xs sm:text-sm md:text-base font-medium">Your Balance:</span>
          <span className="text-xs sm:text-sm md:text-base font-semibold truncate max-w-full sm:max-w-[180px] md:max-w-[200px]">
            {loading ? (
                <span className="animate-pulse text-muted-foreground">Loading...</span>
            ) : (
                `${balance} ${tokenSymbol}`
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// FaucetCard component (unchanged)
function FaucetCard({ faucet, onNetworkSwitch }: { faucet: FaucetData; onNetworkSwitch: () => Promise<void> }) {
  const { chainId } = useWallet();
  const isOnCorrectNetwork = chainId === faucet.network?.chainId;
  const [startCountdown, setStartCountdown] = useState<string>("");
  const [endCountdown, setEndCountdown] = useState<string>("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const start = Number(faucet.startTime || 0) * 1000;
      const end = Number(faucet.endTime || 0) * 1000;

      if (!start) {
        setStartCountdown("Inactive");
      } else if (start > now) {
        const diff = start - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setStartCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s until active`);
      } else {
        setStartCountdown("Already Active");
      }

      if (end > now && faucet.isClaimActive) {
        const diff = end - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setEndCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s until inactive`);
      } else if (end > 0 && end <= now) {
        setEndCountdown("Ended");
      } else {
        setEndCountdown("N/A");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [faucet.startTime, faucet.endTime, faucet.isClaimActive]);

  const displayTokenSymbol = faucet.tokenSymbol || 
    (faucet.isEther ? getNativeTokenSymbol(faucet.network?.name || "Ethereum") : "TOK");

  return (
    <Card className="relative w-full max-w-[400px] mx-auto">
     
      <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-4">
        <CardTitle className="text-sm sm:text-base md:text-lg flex items-center justify-between ">
          <span className="truncate">{faucet.name || `${displayTokenSymbol} Faucet`}</span>
          <div className="flex items-center gap-2">
            {faucet.isClaimActive ? (
              <span className="text-[10px] sm:text-xs md:text-sm bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 sm:px-2 py-0.5 rounded-full">
                Active
              </span>
            ) : (
              <span className="text-[10px] sm:text-xs md:text-sm bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 sm:px-2 py-0.5 rounded-full">
                Inactive
              </span>
            )}
            {faucet.network && (
                <Badge
                  style={{ backgroundColor: faucet.network.color }}
                  className="text-white text-[10px] sm:text-xs md:text-sm font-medium px-1.5 sm:px-2 py-0.5 sm:py-1"
                >
                  {faucet.network.name}
                </Badge>
            )}
          </div>
        </CardTitle>
        
        <div className="px-3 sm:px-4 pt-2">
          <img 
            src={faucet.imageUrl || DEFAULT_FAUCET_IMAGE} 
            alt={faucet.name || 'Faucet'} 
            className="w-full h-32 sm:h-40 object-cover rounded-lg"
            onError={(e) => { e.currentTarget.src = DEFAULT_FAUCET_IMAGE; }}
          />
        </div>
        
        <div className="px-3 sm:px-4 pb-2">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {faucet.description || (faucet.network && faucet.owner 
              ? getDefaultDescription(faucet.network.name, faucet.owner)
              : `A faucet for ${displayTokenSymbol} tokens`
            )}
          </p>
        </div>
        
        <CardDescription className="text-[10px] sm:text-xs md:text-sm truncate">
          {faucet.faucetAddress}
        </CardDescription>
      </CardHeader>
      <div className="px-3 sm:px-4 pb-1 sm:pb-2">
        {isOnCorrectNetwork ? (
          <TokenBalance
            tokenAddress={faucet.token || ZeroAddress}
            tokenSymbol={displayTokenSymbol}
            tokenDecimals={faucet.tokenDecimals || 18}
            isNativeToken={faucet.isEther}
            networkChainId={faucet.network?.chainId || 0}
          />
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-2 sm:p-3 md:p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="text-xs sm:text-sm md:text-base font-medium">Balance:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNetworkSwitch}
                  className="text-xs sm:text-sm md:text-base h-8 sm:h-9 w-full sm:w-auto"
                >
                  Switch to {faucet.network?.name || "Network"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <CardContent className="pb-1 sm:pb-2 px-3 sm:px-4">
        <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm md:text-base">
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground">Network:</span>
            <span className="font-medium truncate">
              {faucet.network?.name || "Unknown"}
            </span>
          </div>
          
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground">Drip Amount:</span>
            <span className="font-medium truncate">
              {faucet.claimAmount
                ? Number(formatUnits(faucet.claimAmount, faucet.tokenDecimals || 18)).toFixed(4)
                : "0"}{" "}
              {displayTokenSymbol}
            </span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground">Type:</span>
            <span className="font-medium">{faucet.isEther ? "Native Token" : "ERC20 Token"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-muted-foreground" />
            <span>{startCountdown}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-muted-foreground" />
            <span>{endCountdown}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="px-3 sm:px-4">
        <Link
          href={`/faucet/${faucet.faucetAddress}?networkId=${faucet.network?.chainId}`}
          className="w-full"
        >
          <Button
            variant="outline"
            className="w-full h-8 sm:h-9 md:h-10 text-xs sm:text-sm md:text-base"
          >
            <Coins className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

// Search and Filter Controls (unchanged)
function SearchAndFilterControls({ searchTerm, setSearchTerm, filterBy, setFilterBy, sortBy, setSortBy, onClearFilters, hasActiveFilters }: { searchTerm: string; setSearchTerm: (term: string) => void; filterBy: FilterOption; setFilterBy: (filter: FilterOption) => void; sortBy: SortOption; setSortBy: (sort: SortOption) => void; onClearFilters: () => void; hasActiveFilters: boolean; }) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
      {/* Search Bar */}
      <div className="relative">
        <div className="flex items-center border border-input rounded-md h-8 sm:h-9 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search faucets by name, symbol, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 h-9 sm:h-10 text-xs sm:text-sm"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center border border-input rounded-md h-8 sm:h-9 px-2 w-full">
            <Filter className="h-4 w-4 text-muted-foreground mr-2" />
            <Select value={filterBy} onValueChange={(value: FilterOption) => setFilterBy(value)}>
              <SelectTrigger className="border-0 shadow-none h-full p-0 text-xs sm:text-sm focus:ring-0 focus:outline-none">
                <SelectValue placeholder="Filter by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_OPTIONS.ALL}>All Faucets</SelectItem>
                <SelectItem value={FILTER_OPTIONS.ACTIVE}>Active Only</SelectItem>
                <SelectItem value={FILTER_OPTIONS.INACTIVE}>Inactive Only</SelectItem>
                <SelectItem value={FILTER_OPTIONS.NATIVE}>Native Tokens</SelectItem>
                <SelectItem value={FILTER_OPTIONS.ERC20}>ERC20 Tokens</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center border border-input rounded-md h-8 sm:h-9 px-2 w-full">
            <SortAsc className="h-4 w-4 text-muted-foreground mr-2" />
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="border-0 shadow-none h-full p-0 text-xs sm:text-sm focus:ring-0 focus:outline-none">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SORT_OPTIONS.DEFAULT}>Default (Active First)</SelectItem>
                <SelectItem value={SORT_OPTIONS.NAME_ASC}>Name A-Z</SelectItem>
                <SelectItem value={SORT_OPTIONS.NAME_DESC}>Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="h-8 sm:h-9 text-xs sm:text-sm px-3"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}


// --- MAIN COMPONENT: NetworkFaucets ---

export default function NetworkFaucets() {
  const { chainId: chainIdStr } = useParams<{ chainId: string }>();
  const router = useRouter();
  const { provider, ensureCorrectNetwork } = useWallet();
  const { networks, setNetwork } = useNetwork();
  const { toast } = useToast();
  const { goBack } = usePreviousPage();
  
  // 🌟 State for ALL faucet metadata (lightweight)
  const [allFaucetsMeta, setAllFaucetsMeta] = useState<FaucetMeta[]>([]); 
  // 🌟 State for current page's FULL details (heavy)
  const [currentPageDetails, setCurrentPageDetails] = useState<FaucetData[]>([]);

  const [loadingInitial, setLoadingInitial] = useState(true); 
  const [loadingPageDetails, setLoadingPageDetails] = useState(false); 
  
  const [page, setPage] = useState(1);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const { width, height } = useWindowSize();

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState<FilterOption>(FILTER_OPTIONS.ALL);
  const [sortBy, setSortBy] = useState<SortOption>(SORT_OPTIONS.DEFAULT);

  // Parse chainId and find network
  const chainId = chainIdStr ? parseInt(chainIdStr, 10) : NaN;
  const network = !isNaN(chainId) ? networks.find((n) => n.chainId === chainId) : undefined;

  // Calculate faucetsPerPage
  const calculateFaucetsPerPage = useCallback(() => {
    // Determine responsive pagination size (e.g., 6 for desktop, 3 for mobile)
    const columns = width < 640 ? 1 : width < 1024 ? 2 : 3;
    let cardsPerColumn = Math.floor((height * 0.7) / 350); // Estimate card height ~350px, use 70% of screen height
    cardsPerColumn = Math.max(1, cardsPerColumn);
    let faucetsPerPage = cardsPerColumn * columns;

    faucetsPerPage = Math.max(3, Math.min(12, faucetsPerPage));
    return faucetsPerPage;
  }, [width, height]);

  const [faucetsPerPage, setFaucetsPerPage] = useState(calculateFaucetsPerPage());

  useEffect(() => {
    const newFaucetsPerPage = calculateFaucetsPerPage();
    if (newFaucetsPerPage !== faucetsPerPage) {
      setFaucetsPerPage(newFaucetsPerPage);
      setPage(1);
    }
  }, [calculateFaucetsPerPage, faucetsPerPage]);


  // 🌟 STEP 1: Filter and sort the ALL FAUCET METADATA (Lightweight)
  const filteredAndSortedMeta = useMemo(() => {
    let filtered = [...allFaucetsMeta]; 

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((faucet) => {
        const name = (faucet.name || faucet.tokenSymbol || "").toLowerCase();
        const symbol = (faucet.tokenSymbol || "").toLowerCase();
        const address = faucet.faucetAddress.toLowerCase();
        return name.includes(search) || symbol.includes(search) || address.includes(search);
      });
    }

    // Apply type filter
    if (filterBy !== FILTER_OPTIONS.ALL) {
      filtered = filtered.filter((faucet) => {
        switch (filterBy) {
          case FILTER_OPTIONS.ACTIVE: return faucet.isClaimActive;
          case FILTER_OPTIONS.INACTIVE: return !faucet.isClaimActive;
          case FILTER_OPTIONS.NATIVE: return faucet.isEther;
          case FILTER_OPTIONS.ERC20: return !faucet.isEther;
          default: return true;
        }
      });
    }

    // Apply sorting (Only supports sorting by active status and creation time/name)
    filtered.sort((a, b) => {
      switch (sortBy) {
        case SORT_OPTIONS.DEFAULT:
          if (a.isClaimActive !== b.isClaimActive) {
            return a.isClaimActive ? -1 : 1;
          }
          const aTime = Number(a.createdAt || 0);
          const bTime = Number(b.createdAt || 0);
          return bTime - aTime;
        case SORT_OPTIONS.NAME_ASC:
          const aName = (a.name || a.tokenSymbol || "").toLowerCase();
          const bName = (b.name || b.tokenSymbol || "").toLowerCase();
          return aName.localeCompare(bName);
        case SORT_OPTIONS.NAME_DESC:
          const aNameDesc = (a.name || a.tokenSymbol || "").toLowerCase();
          const bNameDesc = (b.name || b.tokenSymbol || "").toLowerCase();
          return bNameDesc.localeCompare(aNameDesc);
        default:
          return 0;
      }
    });

    return filtered;
  }, [allFaucetsMeta, searchTerm, filterBy, sortBy]);


  // 🌟 CORE FUNCTION 1: Load ALL Faucet Addresses/Minimal Metadata (FAST)
const loadAllFaucetsMetadata = useCallback(async () => {
    if (!network || isNaN(chainId)) return;

    setLoadingInitial(true);
    
    try {
        const networkProvider = new JsonRpcProvider(network.rpcUrl);
        
        // 1. Fetch the list of permanently deleted addresses from the backend
        const deletedAddressesSet = await fetchDeletedFaucetsSet();

        // 2. Fetch ALL faucets on-chain without filtering
        const allFetchedMeta: FaucetMeta[] = await getFaucetsForNetwork(network, networkProvider);
        
        // 3. Filter the list using the off-chain database index
        const activeMetaList = allFetchedMeta.filter(meta => {
            return !deletedAddressesSet.has(meta.faucetAddress.toLowerCase());
        });

        setAllFaucetsMeta(activeMetaList);
        setPage(1); 
        console.log(`✅ Loaded ${allFetchedMeta.length} faucets. Filtered ${allFetchedMeta.length - activeMetaList.length} deleted faucets via backend check. Total active: ${activeMetaList.length}.`);

    } catch (error) {
        console.error("❌ Error loading all faucet metadata:", error);
        toast({ title: "Failed to load faucet list", variant: "destructive" });
        setAllFaucetsMeta([]);
    } finally {
        setLoadingInitial(false);
    }
}, [network, chainId, toast]);

  // 🌟 CORE FUNCTION 2: Load Full Details for the Current Page (Heavy Fetch)
  const loadCurrentPageDetails = useCallback(async (
      page: number, 
      perPage: number, 
      sortedMeta: FaucetMeta[]
  ) => {
      if (!network || isNaN(chainId) || sortedMeta.length === 0) {
          setCurrentPageDetails([]);
          setLoadingPageDetails(false);
          return;
      }

      setLoadingPageDetails(true);
      setCurrentPageDetails([]); 

      try {
          // 1. Determine the FaucetMeta objects for the current page
          const startIndex = (page - 1) * perPage;
          const endIndex = page * perPage;
          const metaToFetch = sortedMeta.slice(startIndex, endIndex);

          if (metaToFetch.length === 0) return;

          console.log(`Fetching details for page ${page}: ${metaToFetch.length} faucets`);

          const networkProvider = new JsonRpcProvider(network.rpcUrl);

          // 2. Fetch the full details in parallel, calling the correct factory for each faucet
          const detailPromises = metaToFetch.map(async (meta) => {
              // Call the specific factory using the address stored in meta
              const faucetDetail = await getFaucetDetailsFromFactory(
                  meta.factoryAddress, 
                  meta.faucetAddress, 
                  networkProvider
              );
              
              // 3. Load off-chain metadata (description and image) and merge
              const metadata = await loadFaucetMetadata(faucetDetail.faucetAddress);
              
              return {
                  ...faucetDetail,
                  network: network,
                  tokenSymbol: faucetDetail.tokenSymbol || 
                      (faucetDetail.isEther ? getNativeTokenSymbol(network.name) : "TOK"),
                  imageUrl: metadata.imageUrl || DEFAULT_FAUCET_IMAGE,
                  description: metadata.description || (
                      faucetDetail.owner 
                          ? getDefaultDescription(network.name, faucetDetail.owner)
                          : `A faucet for ${faucetDetail.tokenSymbol || 'tokens'} on ${network.name}`
                  ),
                  createdAt: meta.createdAt || faucetDetail.createdAt,
                  tokenDecimals: faucetDetail.tokenDecimals || 18, 
              } as FaucetData;
          });
          
          const detailedFaucets: FaucetData[] = await Promise.all(detailPromises);

          setCurrentPageDetails(detailedFaucets);
      } catch (error) {
          console.error("❌ Error loading page details:", error);
          toast({ title: "Failed to load faucet details for page", variant: "destructive" });
      } finally {
          setLoadingPageDetails(false);
      }
  }, [network, chainId, toast, faucetsPerPage]);


  // Effect 1: Trigger initial load of ALL addresses/minimal metadata 
  useEffect(() => {
    if (isNaN(chainId) || !network) {
      console.log("❌ Invalid chainId or network not found", { chainId, network, chainIdStr });
      setLoadingInitial(false);
      toast({
        title: "Network Not Found",
        description: `Network with chain ID ${chainIdStr || "unknown"} is not supported`,
        variant: "destructive",
      });
      router.push("/");
      return;
    }

    loadAllFaucetsMetadata();
  }, [chainId, network, router, toast, loadAllFaucetsMetadata, chainIdStr]);
  

  // Effect 2: Trigger detailed page load whenever page/filters/perPage changes
  useEffect(() => {
    if (!loadingInitial && filteredAndSortedMeta.length > 0) {
        loadCurrentPageDetails(page, faucetsPerPage, filteredAndSortedMeta);
    } else if (!loadingInitial) {
        setCurrentPageDetails([]);
        setLoadingPageDetails(false);
    }
  }, [
    page, 
    faucetsPerPage, 
    filteredAndSortedMeta,
    loadingInitial, 
    loadCurrentPageDetails
  ]);

  // Handle page reset on filter change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterBy, sortBy]);


  const handleNetworkSwitch = async (targetChainId: number) => {
    setSwitchingNetwork(true);
    try {
      const targetNetwork = networks.find((n) => n.chainId === targetChainId);
      if (!targetNetwork) {
        throw new Error(`Target network with chainId ${targetChainId} not found`);
      }
      setNetwork(targetNetwork);
      await ensureCorrectNetwork(targetChainId);
    } catch (error) {
      console.error("❌ Error switching network:", error);
      toast({ title: "Network switch failed", description: "Failed to switch network. Please try again.", variant: "destructive", });
    } finally {
      setSwitchingNetwork(false);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterBy(FILTER_OPTIONS.ALL);
    setSortBy(SORT_OPTIONS.DEFAULT);
    setPage(1);
  };

  const hasActiveFilters = searchTerm.trim() !== "" || filterBy !== FILTER_OPTIONS.ALL || sortBy !== SORT_OPTIONS.DEFAULT;

  
  // Total pages based on the FILTERED/SORTED META LIST
  const totalPages = Math.ceil(filteredAndSortedMeta.length / faucetsPerPage);
  
  // The actual faucets to render are in currentPageDetails
  const faucetsToRender = currentPageDetails;
  
  // Show the global loading state
  const isLoading = loadingInitial || loadingPageDetails;


  const getPageButtons = () => {
    const buttons = [];
    const maxButtons = 5;
    const start = Math.max(1, page - Math.floor(maxButtons / 2));
    const end = Math.min(totalPages, start + maxButtons - 1);

    if (start > 1) {
      buttons.push(<Button key={1} variant={1 === page ? "default" : "outline"} size="sm" onClick={() => setPage(1)} className="w-8 h-8 sm:w-9 sm:h-9 text-xs sm:text-sm">1</Button>);
      if (start > 2) buttons.push(<span key="start-ellipsis" className="text-xs sm:text-sm">...</span>);
    }

    for (let p = start; p <= end; p++) {
      buttons.push(
        <Button
          key={p}
          variant={p === page ? "default" : "outline"}
          size="sm"
          onClick={() => setPage(p)}
          className="w-8 h-8 sm:w-9 sm:h-9 text-xs sm:text-sm"
        >
          {p}
        </Button>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(<span key="end-ellipsis" className="text-xs sm:text-sm">...</span>);
      buttons.push(<Button key={totalPages} variant={totalPages === page ? "default" : "outline"} size="sm" onClick={() => setPage(totalPages)} className="w-8 h-8 sm:w-9 sm:h-9 text-xs sm:text-sm">{totalPages}</Button>);
    }

    return buttons;
  };

  if (loadingInitial) {
    return <LoadingPage />;
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={goBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <Header
            pageTitle={`Faucets on ${network?.name || "Unknown Network"}`}
            onRefresh={loadAllFaucetsMetadata} 
            loading={isLoading}
          />
        </div>
      </div>

      {/* Search and Filter Controls */}
      <SearchAndFilterControls
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterBy={filterBy}
        setFilterBy={setFilterBy}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Conditional Rendering based on state */}
      {isLoading ? (
        <div className="flex justify-center items-center py-8 sm:py-10 md:py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base">
                {loadingInitial ? "Loading all faucet list..." : "Fetching current page details..."}
            </p>
          </div>
        </div>
      ) : filteredAndSortedMeta.length === 0 ? (
        <Card className="w-full max-w-[400px] mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-6 sm:py-8 md:py-10">
            <Coins className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-muted-foreground mb-2 sm:mb-3 md:mb-4" />
            <h3 className="text-base sm:text-lg md:text-xl font-medium mb-1 sm:mb-2">
              {allFaucetsMeta.length === 0 ? "No Faucets Found" : "No Matching Faucets"}
            </h3>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-3 sm:mb-4 md:mb-6 text-center">
              {allFaucetsMeta.length === 0 
                ? `No faucets are available on ${network?.name || "this network"} yet.`
                : "Try adjusting your search or filter criteria."
              }
            </p>
            {allFaucetsMeta.length === 0 ? (
              <Link href="/create">
                <Button className="h-8 sm:h-9 md:h-10 text-xs sm:text-sm md:text-base">
                  Create Faucet
                </Button>
              </Link>
            ) : (
              <Button 
                onClick={handleClearFilters}
                className="h-8 sm:h-9 md:h-10 text-xs sm:text-sm md:text-base"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Results Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <span>
              Showing {filteredAndSortedMeta.length} of {allFaucetsMeta.length} faucets on {network?.name || "Unknown Network"}
              {hasActiveFilters && " (filtered)"}
            </span>
            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <span className="text-primary font-medium">Filters applied</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-6 text-xs px-2"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {/* Render the details of the CURRENT PAGE ONLY */}
            {faucetsToRender.map((faucet) => (
              <FaucetCard
                key={`${faucet.faucetAddress}-${network?.chainId || chainId}`}
                faucet={faucet}
                onNetworkSwitch={() => handleNetworkSwitch(faucet.network?.chainId || 0)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 mt-4 sm:mt-6">
              <div className="text-xs sm:text-sm md:text-base text-muted-foreground text-center sm:text-left">
                Showing {(page - 1) * faucetsPerPage + 1} to{" "}
                {Math.min(page * faucetsPerPage, filteredAndSortedMeta.length)} of {filteredAndSortedMeta.length} faucets
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                  className="h-8 sm:h-9 md:h-10 text-xs sm:text-sm md:text-base px-2 sm:px-3"
                >
                  Previous
                </Button>
                {getPageButtons()}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isLoading}
                  className="h-8 sm:h-9 md:h-10 text-xs sm:text-sm md:text-base px-2 sm:px-3"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}