"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/hooks/use-wallet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NetworkSelector } from "@/components/network-selector"
import { claimViaBackend } from "@/lib/backend-service"
import { ArrowLeft, Users } from "lucide-react"
import Link from "next/link"
import { useNetwork } from "@/hooks/use-network"
import { BrowserProvider } from "ethers"

export default function BatchClaimPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { address, isConnected, provider } = useWallet()
  const { network } = useNetwork()

  const [faucetAddress, setFaucetAddress] = useState("")
  const [secretCode, setSecretCode] = useState("")
  const [addresses, setAddresses] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const handleBatchClaim = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to process batch drops",
        variant: "destructive",
      })
      return
    }

    if (!provider) {
      toast({
        title: "Provider not available",
        description: "Wallet provider is not available",
        variant: "destructive",
      })
      return
    }

    // Ensure we're on the correct network
    if (network) {
      const isCorrectNetwork = await network.chainId
      if (!isCorrectNetwork) return
    }

    if (!faucetAddress) {
      toast({
        title: "Faucet address required",
        description: "Please enter a valid faucet address",
        variant: "destructive",
      })
      return
    }

    const addressList = addresses
      .split(/[\n,]/)
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0 && addr.startsWith("0x"))

    if (addressList.length === 0) {
      toast({
        title: "No valid addresses",
        description: "Please enter at least one valid Ethereum address",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    let successCount = 0
    let failCount = 0

    try {
      // Process each address sequentially
      for (const userAddress of addressList) {
        try {
          await claimViaBackend(userAddress, faucetAddress, provider as BrowserProvider, secretCode)
          successCount++
        } catch (error) {
          console.error(`Error dropping for ${userAddress}:`, error)
          failCount++
        }
      }

      toast({
        title: "Batch drop processed",
        description: `Successfully dropped for ${successCount} addresses. Failed: ${failCount}`,
        variant: successCount > 0 ? "default" : "destructive",
      })

      if (successCount > 0) {
        // Clear form on success
        setAddresses("")
      }
    } catch (error) {
      console.error("Error in batch drop:", error)
      toast({
        title: "Batch drop failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 max-w-2xl mx-auto">
          <header className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Batch Drop</h1>
            <div className="ml-auto">
              <NetworkSelector />
            </div>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Batch Drop Tokens</CardTitle>
              <CardDescription>Drop tokens for multiple addresses at once</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="faucet-address">Faucet Address</Label>
                <Input
                  id="faucet-address"
                  placeholder="0x..."
                  value={faucetAddress}
                  onChange={(e) => setFaucetAddress(e.target.value)}
                  disabled={isProcessing}
                />
                <p className="text-sm text-muted-foreground">The address of the faucet to drop from</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret-code">Drop Code (for backend-managed faucets)</Label>
                <Input
                  id="secret-code"
                  placeholder="Enter 6-character code (e.g., ABC123)"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  disabled={isProcessing}
                />
                <p className="text-sm text-muted-foreground">
                  Required for backend-managed faucets. Leave empty for manual whitelist faucets.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="claim-addresses">Addresses (one per line or comma separated)</Label>
                <Textarea
                  id="claim-addresses"
                  placeholder="0x..."
                  value={addresses}
                  onChange={(e) => setAddresses(e.target.value)}
                  rows={10}
                  disabled={isProcessing}
                />
                <p className="text-sm text-muted-foreground">
                  Enter Ethereum addresses to drop tokens for. The backend will process these drops.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={handleBatchClaim}
                disabled={isProcessing || !isConnected || !faucetAddress || !addresses.trim()}
              >
                {isProcessing ? (
                  "Processing..."
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Process Batch Drop
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  )
}