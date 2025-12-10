"use client"

import { useWallet } from "./wallet-provider"
import { Button } from "@/components/ui/button"
import { Network as NetworkIcon, Wifi, WifiOff, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const CELO_CHAIN_ID = 42220

export function NetworkSelector({ className }: { className?: string }) {
  const { chainId, isConnected, switchChain } = useWallet()
  const { toast } = useToast()

  const handleSwitchToCelo = async () => {
    if (!isConnected) {
      toast({
        title: "Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      })
      return
    }

    if (chainId === CELO_CHAIN_ID) {
      toast({
        title: "Already on Celo",
        description: "You're already connected to Celo network"
      })
      return
    }

    try {
      await switchChain(CELO_CHAIN_ID)
    } catch (error) {
      console.error('Failed to switch to Celo:', error)
    }
  }

  const getStatus = () => {
    if (!isConnected) {
      return {
        icon: WifiOff,
        color: 'text-red-500',
        text: 'Not Connected'
      }
    }
    
    if (chainId === CELO_CHAIN_ID) {
      return {
        icon: Wifi,
        color: 'text-green-500',
        text: 'Celo'
      }
    }

    return {
      icon: AlertTriangle,
      color: 'text-orange-500',
      text: 'Wrong Network'
    }
  }

  const status = getStatus()
  const StatusIcon = status.icon

  return (
    <Button
      variant="outline"
      onClick={handleSwitchToCelo}
      className={`flex items-center gap-2 ${className}`}
      disabled={!isConnected || chainId === CELO_CHAIN_ID}
    >
      <StatusIcon className={`h-4 w-4 ${status.color}`} />
      <span>{status.text}</span>
      {chainId !== CELO_CHAIN_ID && isConnected && (
        <span className="text-xs text-muted-foreground ml-1">
          (Click to switch)
        </span>
      )}
    </Button>
  )
}

export function NetworkStatusIndicator({ className }: { className?: string }) {
  const { chainId, isConnected } = useWallet()

  if (!isConnected) {
    return (
      <div className={`flex items-center space-x-2 text-red-600 ${className}`}>
        <div className="w-4 h-4 bg-red-400 rounded-full" />
        <span className="text-sm">No network connected</span>
      </div>
    )
  }

  const isCorrectNetwork = chainId === CELO_CHAIN_ID

  return (
    <div 
      className={`flex items-center space-x-2 ${
        isCorrectNetwork ? 'text-green-600' : 'text-amber-600'
      } ${className}`}
    >
      <div 
        className={`w-4 h-4 rounded-full ${
          isCorrectNetwork ? 'bg-green-400' : 'bg-amber-400'
        }`} 
      />
      <span className="text-sm">
        {isCorrectNetwork 
          ? 'Connected to Celo' 
          : `Wrong network (expected Celo)`
        }
      </span>
    </div>
  )
}

export function CompactNetworkSelector({ className }: { className?: string }) {
  const { chainId, isConnected } = useWallet()

  if (!isConnected) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full border border-red-200 ${className}`}>
        <WifiOff className="h-3 w-3 text-red-500" />
        <span className="text-xs text-red-600">Disconnected</span>
      </div>
    )
  }

  const isCelo = chainId === CELO_CHAIN_ID

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
        isCelo 
          ? 'bg-green-50 border-green-200' 
          : 'bg-orange-50 border-orange-200'
      } ${className}`}
    >
      <NetworkIcon className={`h-3 w-3 ${isCelo ? 'text-green-600' : 'text-orange-600'}`} />
      <span className={`text-xs ${isCelo ? 'text-green-600' : 'text-orange-600'}`}>
        {isCelo ? 'Celo' : `Chain ${chainId}`}
      </span>
    </div>
  )
}