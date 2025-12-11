"use client"

import { useState } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { claimViaBackend } from "@/lib/backend-service"
import { Users } from "lucide-react"
// Add the useNetwork import
import { NetworkProvider, useNetwork } from "@/hooks/use-network"

interface BatchclaimProps {
  faucetAddress: string
}

// Update the Batchdropcomponent to include network checking
export function Batchclaim({ faucetAddress }: BatchclaimProps) {
  const { toast } = useToast()
  const { address, ensureCorrectNetwork } = useWallet()
  const { network } = useNetwork()
  const [addresses, setAddresses] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [secretCode, setSecretCode] = useState("")
  const Provider = NetworkProvider // Ensure Provider is correctly imported or defined
  const handleBatchclaim= async () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to process batch claims",
        variant: "destructive",
      })
      return
    }

    // Ensure we're on the correct network
    if (network) {
      const isCorrectNetwork = await ensureCorrectNetwork(network.chainId)
      if (!isCorrectNetwork) return
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
          await claimViaBackend(userAddress, faucetAddress, Provider,secretCode)
          successCount++
        } catch (error) {
          console.error(`Error  droping for ${userAddress}:`, error)
          failCount++
        }
      }

      toast({
        title: "Batch drop processed",
        description: `Successfully  droped for ${successCount} addresses. Failed: ${failCount}`,
        variant: successCount > 0 ? "default" : "destructive",
      })
    } catch (error) {
      console.error("Error in batch  drop:", error)
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
    <Card>
      <CardHeader>
        <CardTitle>Batch drop</CardTitle>
        <CardDescription>drop tokens for multiple addresses at once</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Enter addresses (one per line or comma separated)"
              value={addresses}
              onChange={(e) => setAddresses(e.target.value)}
              rows={5}
              disabled={isProcessing}
            />
            <p className="text-sm text-muted-foreground">
              Enter Ethereum addresses to drop tokens for. The backend will process these  drops.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleBatchclaim} disabled={isProcessing || !address || !addresses.trim()}>
          {isProcessing ? (
            "Processing..."
          ) : (
            <>
              <Users className="mr-2 h-4 w-4" />
              Process Batch  drop
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
