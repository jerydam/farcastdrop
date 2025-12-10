"use client"

import { Button } from "@/components/ui/button"
import { Wallet, ChevronDown, LayoutDashboard, Copy, LogOut } from "lucide-react"
import { useWallet } from "./wallet-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

export function WalletConnectButton({ className }: { className?: string }) {
  const { address, isConnected, connect, chainId } = useWallet()
  const { toast } = useToast()
  
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      toast({ title: "Address Copied" })
    }
  }

  const getChainName = (id: number | null) => {
    if (id === 42220) return "Celo"
    return `Chain ${id}`
  }

  // Not connected
  if (!isConnected || !address) {
    return (
      <Button 
        onClick={() => connect()} 
        size="sm" 
        className="flex items-center gap-2 font-semibold"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    )
  }

  // Connected
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2 border-primary/20"
        >
          <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="font-mono text-xs sm:text-sm">
            {formatAddress(address)}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Farcaster Wallet
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled className="text-xs">
            Network: {getChainName(chainId)}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link 
              href="/faucet/dashboard" 
              className="cursor-pointer flex items-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleCopyAddress} 
            className="cursor-pointer flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            <span>Copy Address</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          {address}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}