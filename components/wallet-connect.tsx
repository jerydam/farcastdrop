"use client"

import { useWallet } from "./wallet-provider" // Adjust path to new provider
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function WalletConnectButton() {
  const { address, isConnected, isConnecting } = useWallet()

  if (isConnecting) {
    return <Button variant="ghost" size="sm"><Loader2 className="h-4 w-4 animate-spin" /></Button>
  }

  if (!isConnected) {
    // This ideally shouldn't happen inside Farcaster if permissions are granted, 
    // but useful fallback
    return <Button size="sm">Please Authorize</Button>
  }

  return (
    <Button variant="outline" size="sm" className="font-mono text-xs cursor-default">
      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-2" />
      {address?.slice(0, 6)}...{address?.slice(-4)}
    </Button>
  )
}