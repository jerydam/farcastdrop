"use client"

import { useAppKit } from '@reown/appkit/react'
import { Button } from "@/components/ui/button"
import { Wallet, ChevronDown, LayoutDashboard, Copy, ExternalLink, LogOut, User2 } from "lucide-react"
import { useWallet } from "./wallet-provider" // Use your custom hook
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
  const { open } = useAppKit()
  const { address, isConnected, isFarcaster } = useWallet() // Use unified context
  const { toast } = useToast()
  
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      toast({ title: "Address Copied" })
    }
  }

  // 1. FARCASTER STATE
  // If we are in a Farcaster frame, we don't need a "Connect" button, 
  // we just show the connected state (simplified).
  if (isFarcaster && isConnected && address) {
     return (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-full border border-border/50">
           <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
           <span className="font-mono text-xs text-muted-foreground">FC: {formatAddress(address)}</span>
        </div>
     )
  }

  // 2. DISCONNECTED
  if (!isConnected || !address) {
    return (
      <Button onClick={() => open()} size="sm" className="flex items-center gap-2 font-semibold">
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    )
  }

  // 3. STANDARD CONNECTED
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 border-primary/20">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-xs sm:text-sm">{formatAddress(address)}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">My Account</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
             <Link href="/faucet/dashboard" className="cursor-pointer flex items-center gap-2">
               <LayoutDashboard className="h-4 w-4" />
               <span>Dashboard</span>
             </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyAddress} className="cursor-pointer flex items-center gap-2">
             <Copy className="h-4 w-4" />
             <span>Copy Address</span>
          </DropdownMenuItem>
          {/* ... other items ... */}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => open()} className="cursor-pointer flex items-center gap-2">
             <ExternalLink className="h-4 w-4" />
             <span>Wallet Settings</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}