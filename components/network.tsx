"use client";

import { useEffect, useState } from "react";
// Assuming useWallet and useNetwork are imported correctly
import { useWallet } from "@/hooks/use-wallet"; 
import { useNetwork } from "@/hooks/use-network"; 
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, Zap, AlertTriangle } from "lucide-react";
import Link from "next/link";
// Assuming getFaucetsForNetwork is imported correctly
import { getFaucetsForNetwork } from "@/lib/faucet"; 

// --- TYPE EXTENSIONS ---
// Re-defining the structure with logoUrl for clarity in this component
interface Network {
  chainId: number;
  name: string;
  color: string;
  logoUrl: string; // <-- New property used for the logo
}

// --- NEW SUB-COMPONENT: StatusBadge ---
interface StatusBadgeProps {
  status: { loading: boolean; error: string | null } | undefined;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  if (status?.loading) {
    return (
      <div className="flex items-center text-xs text-blue-500">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Loading
      </div>
    );
  }
  if (status?.error) {
    return (
      <div className="flex items-center text-xs text-amber-500">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Issue
      </div>
    );
  }
  return (
    <div className="flex items-center text-xs text-green-500">
      <Zap className="mr-1 h-3 w-3 " />
      Online
    </div>
  );
};

// --- MAIN COMPONENT: NetworkGrid ---

interface NetworkGridProps {
  className?: string;
}

export function NetworkGrid({ className = "" }: NetworkGridProps) {
  // Assuming useWallet returns both chainId and the JsonRpcProvider
  const { chainId, provider } = useWallet(); 
  const { networks } = useNetwork();
  const { toast } = useToast();

  const [networkStatus, setNetworkStatus] = useState<
    Record<string, { loading: boolean; error: string | null }>
  >({});
  const [faucetCounts, setFaucetCounts] = useState<Record<string, number>>({});
  const [activeFaucetCounts, setActiveFaucetCounts] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    const initialStatus: Record<
      string,
      { loading: boolean; error: string | null }
    > = {};
    const initialFaucetCounts: Record<string, number> = {};
    const initialActiveFaucetCounts: Record<string, number> = {};

    networks.forEach((network: Network) => {
      initialStatus[network.name] = { loading: true, error: null };
      initialFaucetCounts[network.name] = 0;
      initialActiveFaucetCounts[network.name] = 0;
    });

    setNetworkStatus(initialStatus);
    setFaucetCounts(initialFaucetCounts);
    setActiveFaucetCounts(initialActiveFaucetCounts);

    const loadFaucetCounts = async () => {
      const newStatus: Record<
        string,
        { loading: boolean; error: string | null }
      > = {};
      const newCounts: Record<string, number> = {};
      const newActiveCounts: Record<string, number> = {};

      if (!provider) {
        console.warn("Provider is missing; skipping faucet data load.");
        return;
      }

      await Promise.all(
        networks.map(async (network: Network) => {
          // Only attempt to load for the currently connected network for efficiency
          if (network.chainId !== chainId) {
            newStatus[network.name] = { loading: false, error: null };
            newCounts[network.name] = 0;
            newActiveCounts[network.name] = 0;
            return;
          }
          
          try {
            setNetworkStatus((prev) => ({
              ...prev,
              [network.name]: { loading: true, error: null },
            }));

            // FIX: Pass the provider as the second argument
            const faucets = await getFaucetsForNetwork(network, provider); 

            // Assuming FaucetMeta has a boolean 'isClaimActive' property
            const activeFaucets = faucets.filter(
              (faucet) => faucet.isClaimActive
            );

            newCounts[network.name] = faucets.length;
            newActiveCounts[network.name] = activeFaucets.length;
            newStatus[network.name] = { loading: false, error: null };
          } catch (error) {
            console.error(`Error loading faucets for ${network.name}:`, error);
            const errorMessage = `Failed to load faucets`;

            newStatus[network.name] = { loading: false, error: errorMessage };
            newCounts[network.name] = 0;
            newActiveCounts[network.name] = 0;

            toast({
              title: `Connection Error on ${network.name}`,
              description: errorMessage,
              variant: "destructive",
            });
          }
        })
      );

      setNetworkStatus((prev) => ({ ...prev, ...newStatus }));
      setFaucetCounts((prev) => ({ ...prev, ...newCounts }));
      setActiveFaucetCounts((prev) => ({ ...prev, ...newActiveCounts }));
    };

    if (networks.length > 0) {
      loadFaucetCounts();
    }
    
  }, [networks, toast, provider, chainId]); 

  // Find the network matching the current chainId
  const currentNetwork: Network | undefined = networks.find(
    (network: Network) => network.chainId === chainId
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* --- CONNECTED NETWORK CARD (Enhanced) --- */}
      {currentNetwork ? (
        <div className="w-full">
          
          <Link href={`/network/${currentNetwork.chainId}`}>
            <Card className="overflow-hidden shadow-lg border-2 transition-all duration-300 ease-in-out hover:shadow-xl cursor-pointer">
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  {/* ⭐️ LOGO IMPLEMENTATION: Replaced LayoutGrid with <img> */}
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center overflow-hidden"
                    style={{ border: `2px solid ${currentNetwork.color}` }}
                  >
                    <img
                      src={currentNetwork.logoUrl}
                      alt={`${currentNetwork.name} Logo`}
                      className="h-full w-full object-contain p-1" // Added padding to prevent stretching
                    />
                  </div>
                  <CardTitle className="text-lg font-bold truncate text-primary">
                    {currentNetwork.name}
                  </CardTitle>
                </div>

                {/* Status Badge */}
                <StatusBadge status={networkStatus[currentNetwork.name]} />
              </CardHeader>

              <CardContent className="p-4 pt-0 grid grid-cols-2 gap-4 border-t border-dashed">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Faucets</p>
                  <p className="text-2xl font-extrabold text-card-foreground">
                    {faucetCounts[currentNetwork.name] ?? 0}
                  </p>
                </div>
                
              </CardContent>
              <div className=" p-2 text-center text-xs text-primary/80 font-medium">
                Click to explore available faucets on this network →
              </div>
            </Card>
          </Link>
        </div>
      ) : (
        <Card className="p-8 text-center bg-gray-50 dark:bg-gray-900 border-dashed border-2 border-gray-300 dark:border-gray-700">
          <div className="space-y-4">
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mx-auto">
              <Search className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-card-foreground mb-1">
                Network Disconnected
              </h3>
              <p className="text-sm text-muted-foreground">
                Your wallet is not connected to a supported network. Please
                switch networks to see available faucets.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* "All Supported Networks" section removed as requested. */}
    </div>
  );
}