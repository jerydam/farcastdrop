import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Plus, Users, Loader2, Menu, X } from "lucide-react"
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

    // 1. Ensure Network
    const isCorrectNetwork = await ensureCorrectNetwork(42220)
    if (!isCorrectNetwork) {
      toast({ title: "Incorrect network", description: "Switch to Celo (42220).", variant: "destructive" })
      return
    }

    setIsJoiningDroplist(true)

    try {
      const contract = new Contract(DROPLIST_CONTRACT_ADDRESS, CHECKIN_ABI, signer)

      // 2. Check Participation (Optional - we don't block heavily here anymore)
      try {
        const hasJoined = await contract.hasAddressParticipated(address)
        if (hasJoined) {
          // We throw here to stop the UI, but we catch it below to show a nice message
          throw new Error("ALREADY_JOINED")
        }
      } catch (e: any) {
        if (e.message === "ALREADY_JOINED") throw e
        console.warn("Could not check participation status, proceeding anyway...", e)
      }

      // 3. Estimate Gas (With Fallback)
      let gasLimit
      try {
        // Try to estimate gas normally
        gasLimit = await contract.droplist.estimateGas()
        // Add 20% buffer
        gasLimit = (gasLimit * BigInt(120)) / BigInt(100)
      } catch (error) {
        console.warn("Gas estimation failed. Falling back to manual gas limit.", error)
        // FORCE THE TRANSACTION: Set a manual gas limit (e.g., 300,000 gas)
        // This bypasses the "Transaction failed simulation" error
        gasLimit = BigInt(300000) 
      }

      // 4. Send Transaction
      const txData = contract.interface.encodeFunctionData("droplist", [])
      const enhancedData = appendDivviReferralData(txData, address as `0x${string}`)

      const tx = await signer.sendTransaction({
        to: DROPLIST_CONTRACT_ADDRESS,
        data: enhancedData,
        gasLimit: gasLimit, // Uses the estimated OR the manual 300k limit
      })

      console.log("Tx sent:", tx.hash)
      await tx.wait()
      await reportTransactionToDivvi(tx.hash as `0x${string}`, chainId!)

      toast({ title: "Success", description: "Joined successfully!" })

    } catch (error: any) {
      console.error('Join Error:', error)
      
      if (error.message === "ALREADY_JOINED" || error.message?.includes("already joined")) {
        toast({ title: "Already Joined", description: "You are already on the droplist.", variant: "default" })
      } else if (error.code === "ACTION_REJECTED" || error.code === 4001) {
        toast({ title: "Cancelled", description: "Transaction rejected by user.", variant: "destructive" })
      } else {
        // Generic error
        toast({ 
          title: "Transaction Failed", 
          description: error.reason || error.message || "Unknown error", 
          variant: "destructive" 
        })
      }
    } finally {
      setIsJoiningDroplist(false)
    }
  }

  return (
    <header className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 relative z-10">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
        
        {/* Logo Area */}
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

        {/* Desktop Actions */}
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
      
      {/* Mobile Menu */}
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