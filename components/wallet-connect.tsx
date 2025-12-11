// File: components/wallet-connect.tsx
"use client"

import Link from "next/link"
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { Button } from "@/components/ui/button"
import sdk from "@farcaster/miniapp-sdk";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Wallet, 
  LayoutDashboard, 
  LogOut, 
  User2,
  Copy, 
  ChevronDown,
  ExternalLink
} from "lucide-react"
import { useToast } from "@/hooks/use-toast" // Adjust path to your toast hook

interface WalletConnectButtonProps {
  className?: string
}

export function WalletConnectButton({ className }: WalletConnectButtonProps) {
  const { open } = useAppKit()
  
  const { address, isConnected } = useAppKitAccount()
  const { toast } = useToast()
  
  // Format address for display (e.g., 0x12...3456)
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      })
    }
  }
const isMiniApp = typeof window !== 'undefined' && !!sdk.wallet;

  // If in MiniApp, you might want to show just the address or a different UI
  // because "Connect Wallet" is redundant.
  if (isMiniApp && address) {
     return (
        <Button variant="ghost" className="font-mono text-xs">
           Farcaster Connected: {formatAddress(address)}
        </Button>
     );
  }
  // 1. DISCONNECTED STATE: Show standard Connect Button
  if (!isConnected || !address) {
    return (
      <Button 
        onClick={() => open()}
        size="sm"
        className="flex items-center gap-2 font-semibold"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    )
  }

  // 2. CONNECTED STATE: Show Dropdown with Dashboard
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
        >
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-xs sm:text-sm">
            {formatAddress(address)}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          My Account
        </DropdownMenuLabel>
        
        <DropdownMenuGroup>
          {/* Dashboard Link */}
          <DropdownMenuItem asChild>
            <Link href="/faucet/dashboard" className="cursor-pointer flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>

          {/* Copy Address */}
          <DropdownMenuItem onClick={handleCopyAddress} className="cursor-pointer flex items-center gap-2">
            <Copy className="h-4 w-4" />
            <span>Copy Address</span>
          </DropdownMenuItem>
           <DropdownMenuItem asChild>
            <Link href="/verify" className="cursor-pointer flex items-center gap-2">
              <User2 className="h-4 w-4" />
              <span>Verify</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {/* Open Reown Modal (for network switching/disconnecting) */}
          <DropdownMenuItem onClick={() => open()} className="cursor-pointer flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            <span>Wallet Settings</span>
          </DropdownMenuItem>
          
          {/* Direct Disconnect (optional, usually handled inside open() modal but you can try forcing it if the library exposes a disconnect function) */}
          <DropdownMenuItem 
            onClick={() => open({ view: 'Account' })} 
            className="cursor-pointer flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            <span>Disconnect</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}