"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Users, Loader2 } from "lucide-react"
import { useWallet } from "./wallet-provider"
import { useToast } from "@/hooks/use-toast"
import { Contract } from "ethers"

// Droplist contract details
const DROPLIST_CONTRACT_ADDRESS = "0xB8De8f37B263324C44FD4874a7FB7A0C59D8C58E"
const CELO_CHAIN_ID = 42220

const CHECKIN_ABI = [
  {
    "inputs": [],
    "name": "droplist",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "hasAddressParticipated",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
]

export function JoinDroplistButton() {
  const { address, isConnected, signer, chainId, ensureCorrectNetwork } = useWallet()
  const { toast } = useToast()
  const [isJoining, setIsJoining] = useState(false)
  const [hasJoined, setHasJoined] = useState(false)

  // Check if user has already joined
  const checkParticipation = async () => {
    if (!address || !signer || chainId !== CELO_CHAIN_ID) return

    try {
      const contract = new Contract(DROPLIST_CONTRACT_ADDRESS, CHECKIN_ABI, signer)
      const participated = await contract.hasAddressParticipated(address)
      setHasJoined(participated)
    } catch (error) {
      console.warn("Could not check participation status:", error)
    }
  }

  // Check participation status when wallet connects
  useState(() => {
    if (isConnected && address && chainId === CELO_CHAIN_ID) {
      checkParticipation()
    }
  })

  const handleJoinDroplist = async () => {
    if (!isConnected || !address || !signer) {
      toast({
        title: "Wallet Not Connected",
        description: "Your Farcaster wallet will connect automatically",
        variant: "default",
      })
      return
    }

    // Ensure we're on Celo
    const isCorrectNetwork = await ensureCorrectNetwork(CELO_CHAIN_ID)
    if (!isCorrectNetwork) {
      toast({
        title: "Wrong Network",
        description: "Please switch to Celo network",
        variant: "destructive",
      })
      return
    }

    setIsJoining(true)

    try {
      const contract = new Contract(DROPLIST_CONTRACT_ADDRESS, CHECKIN_ABI, signer)

      // Estimate gas
      const gasLimit = await contract.droplist.estimateGas()
      const gasLimitWithBuffer = (gasLimit * BigInt(120)) / BigInt(100)

      // Send transaction
      const tx = await contract.droplist({
        gasLimit: gasLimitWithBuffer,
      })

      console.log("Droplist transaction sent:", tx.hash)

      // Wait for confirmation
      const receipt = await tx.wait()
      
      if (receipt && receipt.status === 1) {
        setHasJoined(true)
        toast({
          title: "Success! 🎉",
          description: "You've successfully joined the droplist!",
        })
      } else {
        throw new Error("Transaction failed")
      }

    } catch (error: any) {
      console.error("Droplist join error:", error)
      
      let errorMessage = "Failed to join droplist"
      
      if (error.message?.includes("user rejected")) {
        errorMessage = "Transaction was rejected"
      } else if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas fees"
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsJoining(false)
    }
  }

  // Don't show button if not connected or already joined
  if (!isConnected) {
    return null
  }
  return (
    <Button
      onClick={handleJoinDroplist}
      disabled={isJoining}
      size="sm"
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
    >
      {isJoining ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Joining...</span>
        </>
      ) : (
        <>
          <Users className="h-4 w-4" />
          <span>Join Droplist</span>
        </>
      )}
    </Button>
  )
}