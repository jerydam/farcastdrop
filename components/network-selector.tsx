"use client"

import { useWallet } from "./wallet-provider" // Ensure this path matches your file structure
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Loader2, AlertTriangle, Check } from "lucide-react"
import { useState } from "react"

// Define your supported networks here manually since we removed the config file
const SUPPORTED_NETWORKS = [
  { chainId: 8453, name: "Base", symbol: "ETH" },
  { chainId: 42220, name: "Celo", symbol: "CELO" },
  { chainId: 42161, name: "Arbitrum", symbol: "ETH" },
  { chainId: 1135, name: "Lisk", symbol: "ETH" },
  { chainId: 1, name: "Mainnet", symbol: "ETH" },
]

export function NetworkSelector({ className = "" }: { className?: string }) {
  const { chainId, switchChain, isConnected, isConnecting } = useWallet()
  const [isSwitching, setIsSwitching] = useState(false)

  const currentNetwork = SUPPORTED_NETWORKS.find((net) => net.chainId === chainId)

  const handleSwitch = async (targetChainId: number) => {
    if (chainId === targetChainId) return
    setIsSwitching(true)
    try {
      await switchChain(targetChainId)
    } catch (error) {
      console.error("Failed to switch:", error)
    } finally {
      setIsSwitching(false)
    }
  }

  // 1. Loading State
  if (isConnecting) {
    return (
      <Button variant="outline" size="sm" className={className} disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    )
  }

  // 2. Disconnected State
  if (!isConnected) {
    return (
      <Button variant="outline" size="sm" className={className} disabled>
        <AlertTriangle className="mr-2 h-4 w-4 text-yellow-500" />
        Wallet not found
      </Button>
    )
  }

  // 3. Connected State
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={`min-w-[140px] justify-between ${className}`}>
           <span className="flex items-center gap-2">
             {/* You can add network icons here if you have them */}
             {isSwitching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
             ) : (
                <div className={`h-2 w-2 rounded-full ${currentNetwork ? 'bg-green-500' : 'bg-red-500'}`} />
             )}
             {currentNetwork ? currentNetwork.name : "Unknown Chain"}
           </span>
           <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {SUPPORTED_NETWORKS.map((net) => (
          <DropdownMenuItem 
            key={net.chainId}
            onClick={() => handleSwitch(net.chainId)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>{net.name}</span>
            {chainId === net.chainId && <Check className="h-4 w-4 text-green-500" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}