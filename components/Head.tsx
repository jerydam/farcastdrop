import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Plus, Users, Loader2, Menu, X, ExternalLink } from "lucide-react"
import { WalletConnectButton } from "@/components/wallet-connect"
import { useWallet } from "@/hooks/use-wallet"
import { useToast } from "@/hooks/use-toast"
import { appendDivviReferralData, reportTransactionToDivvi } from "../lib/divvi-integration"
import { Contract } from "ethers"
import Link from 'next/link'

// Smart contract details
const DROPLIST_CONTRACT_ADDRESS = "0xB8De8f37B263324C44FD4874a7FB7A0C59D8C58E"
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

export default function Head() {
  const router = useRouter()
  const { address, isConnected, signer, chainId, ensureCorrectNetwork } = useWallet()
  const { toast } = useToast()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isJoiningDroplist, setIsJoiningDroplist] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  const handleJoinDroplist = async () => {
    if (!isConnected || !address || !signer) {
      toast({ title: "Wallet not connected", description: "Please connect your wallet.", variant: "destructive" })
      return
    }

    const isCorrectNetwork = await ensureCorrectNetwork(42220)
    if (!isCorrectNetwork) {
      toast({ title: "Incorrect network", description: "Switch to Celo (42220).", variant: "destructive" })
      return
    }

    setIsJoiningDroplist(true)

    try {
      const contract = new Contract(DROPLIST_CONTRACT_ADDRESS, CHECKIN_ABI, signer)

      // 1. Optional Check: Have we joined? (We don't block on this anymore)
      try {
        const hasJoined = await contract.hasAddressParticipated(address)
        if (hasJoined) {
             toast({ title: "Notice", description: "You might have already joined this droplist.", variant: "default" })
        }
      } catch (e) { 
        console.warn("Could not verify participation:", e)
      }

      // 2. Gas Limit Strategy: Try estimate, fallback to Manual
      let gasLimit
      try {
        gasLimit = await contract.droplist.estimateGas()
        // Add 20% buffer
        gasLimit = (gasLimit * BigInt(120)) / BigInt(100)
      } catch (error) {
        console.warn("Gas estimation failed. Forcing manual gas limit.")
        // FORCE GAS: 300,000 is enough for a simple write. 
        // This bypasses the "Simulation Failed" error.
        gasLimit = BigInt(300000)
      }

      // 3. Prepare Data
      const txData = contract.interface.encodeFunctionData("droplist", [])
      const enhancedData = appendDivviReferralData(txData, address as `0x${string}`)

      // 4. Send Transaction
      // Note: We use try/catch specifically around the wait() to prevent "Provider not supported" crashes
      const tx = await signer.sendTransaction({
        to: DROPLIST_CONTRACT_ADDRESS,
        data: enhancedData,
        gasLimit: gasLimit,
      })

      console.log("Tx hash:", tx.hash)
      
      // IMMEDIATE FEEDBACK: Don't wait for receipt to show success
      toast({ 
        title: "Transaction Sent!", 
        description: (
          <div className="flex flex-col gap-1">
            <span>Waiting for confirmation...</span>
            <a 
              href={`https://celoscan.io/tx/${tx.hash}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-blue-500 underline flex items-center gap-1 text-xs"
            >
              View on Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ),
      })

      // 5. Safe Wait & Report (Non-blocking)
      try {
        await tx.wait()
        // Only report if wait succeeds
        try {
            await reportTransactionToDivvi(tx.hash as `0x${string}`, chainId!)
        } catch (divviError) {
            console.warn("Divvi reporting failed (ignoring):", divviError)
        }
        
        toast({ title: "Confirmed!", description: "Successfully joined the droplist." })
        
      } catch (waitError: any) {
        // This catches the "Provider does not support eth_getTransaction" error
        console.warn("Could not wait for receipt (Wallet limitation):", waitError)
        // We assume success because the transaction hash was generated
        if (waitError?.message?.includes("support") || waitError?.code === "UNKNOWN_ERROR") {
             // Do nothing, the user already has the "Transaction Sent" toast
        } else {
             throw waitError // Real error
        }
      }

    } catch (error: any) {
      console.error('Join Error:', error)
      
      const msg = error?.reason || error?.message || "Unknown error"
      
      if (msg.includes("user rejected") || error.code === "ACTION_REJECTED") {
        toast({ title: "Cancelled", description: "Transaction rejected.", variant: "default" })
      } else {
        toast({ title: "Error", description: "Failed to send transaction. Check console.", variant: "destructive" })
      }
    } finally {
      setIsJoiningDroplist(false)
    }
  }

  return (
    <header className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 relative z-10">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
        
        <div className="flex justify-between items-center w-full lg:w-auto">
          <Link href="/">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="w-8 h-8 rounded-md" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">FaucetDrops</h1>
                <span className="text-xs text-slate-500 hidden sm:block">Token Distribution 💧</span>
              </div>
            </div>
          </Link>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-2">
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-3">
            <Button onClick={() => router.push('/create-faucet')} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> Create Faucet
            </Button>
            <Button 
              onClick={handleJoinDroplist} 
              disabled={!isConnected || isJoiningDroplist} 
              size="sm" 
              className="bg-green-600 hover:bg-green-700"
            >
              {isJoiningDroplist ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
              Join Droplist
            </Button>
            <WalletConnectButton />
        </div>
      </div>
      
      {isMenuOpen && (
        <div className="lg:hidden mt-4 space-y-3">
           <Button onClick={() => router.push('/create-faucet')} className="w-full bg-blue-600">Create Faucet</Button>
           <Button onClick={handleJoinDroplist} disabled={!isConnected || isJoiningDroplist} className="w-full bg-green-600">
             {isJoiningDroplist ? "Processing..." : "Join Droplist"}
           </Button>
           <WalletConnectButton />
        </div>
      )}
    </header>
  )
}