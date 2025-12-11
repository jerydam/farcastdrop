import { useState, useEffect } from 'react'
import Image from 'next/image'
import { NetworkSelector } from "@/components/network-selector"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Plus, Users, Loader2, Menu, X } from "lucide-react"
import {  WalletConnectButton } from "@/components/wallet-connect"
import { useWallet } from "@/components/wallet-provider"
import { useToast } from "@/hooks/use-toast"
import { appendDivviReferralData, reportTransactionToDivvi } from "../lib/divvi-integration"
import { Contract } from "ethers"
import Link from 'next/link'

// Smart contract details
const DROPLIST_CONTRACT_ADDRESS = "0xB8De8f37B263324C44FD4874a7FB7A0C59D8C58E"
const CHECKIN_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "balance", "type": "uint256" }
    ],
    "name": "CheckIn",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "participantCount", "type": "uint256" }
    ],
    "name": "NewParticipant",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "addressToString",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "droplist",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllParticipants",
    "outputs": [
      { "internalType": "address[]", "name": "", "type": "address[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "getBalance",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "index", "type": "uint256" }
    ],
    "name": "getParticipant",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalTransactions",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getUniqueParticipantCount",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
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

// Helper function to safely extract error information
const getErrorInfo = (error: unknown): { code?: string | number; message: string } => {
  if (error && typeof error === "object") {
    const errorObj = error as any
    return {
      code: errorObj.code,
      message: errorObj.message || "Unknown error occurred",
    }
  }
  return {
    message: typeof error === "string" ? error : "Unknown error occurred",
  }
}

export default function Head() {

  const router = useRouter()
  const { address, isConnected, signer, chainId, ensureCorrectNetwork } = useWallet()
  const { toast } = useToast()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Loading State
  const [isJoiningDroplist, setIsJoiningDroplist] = useState(false)
  
  // New droplist states
  const [isDroplistOpen, setIsDroplistOpen] = useState(false)
  const [droplistNotification, setDroplistNotification] = useState<string | null>(null)
  
  // Existing states
  const [isDivviSubmitted, setIsDivviSubmitted] = useState(false)

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  // Close mobile menu when route changes
  useEffect(() => {
    const handleRouteChange = () => {
      setIsMenuOpen(false)
    }
    
    // router.events?.on('routeChangeStart', handleRouteChange)
    // return () => {
    //   router.events?.off('routeChangeStart', handleRouteChange)
    // }
  }, [])

  // Handle joining droplist
  const handleJoinDroplist = async () => {
    console.log('Join Droplist clicked', { isConnected, address, chainId })
    
    if (!isConnected || !address || !signer) {
      setDroplistNotification("Please connect your wallet first")
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to join the droplist",
        variant: "destructive",
      })
      return
    }

    // Ensure correct network (Celo, chain ID 42220)
    const isCorrectNetwork = await ensureCorrectNetwork(42220)
    if (!isCorrectNetwork) {
      setDroplistNotification("Please switch to the Celo network to join the droplist")
      toast({
        title: "Incorrect network",
        description: "Please switch to the Celo network (chain ID 42220)",
        variant: "destructive",
      })
      return
    }

    setIsJoiningDroplist(true)
    setDroplistNotification(null)

    try {
      const contract = new Contract(DROPLIST_CONTRACT_ADDRESS, CHECKIN_ABI, signer)

      // Estimate gas
      let gasLimit: bigint
      try {
        gasLimit = await contract.droplist.estimateGas()
      } catch (error) {
        console.error('Gas estimation error:', getErrorInfo(error))
        throw new Error('Failed to estimate gas for droplist transaction')
      }

      // Add 20% buffer using BigInt operations
      const gasLimitWithBuffer = (gasLimit * BigInt(120)) / BigInt(100)

      // Prepare transaction data
      const txData = contract.interface.encodeFunctionData("droplist", [])
      const enhancedData = appendDivviReferralData(txData, address as `0x${string}`)

      // Send transaction
      const tx = await signer.sendTransaction({
        to: DROPLIST_CONTRACT_ADDRESS,
        data: enhancedData,
        gasLimit: gasLimitWithBuffer,
      })

      console.log('Transaction sent:', tx.hash)

      // Wait for transaction confirmation
      const receipt = await tx.wait()
      
      // Report to Divvi
      await reportTransactionToDivvi(tx.hash as `0x${string}`, chainId!)

      setDroplistNotification("Successfully joined the droplist!")
      setIsDivviSubmitted(true)
      toast({
        title: "Success",
        description: "You have successfully joined the droplist!",
      })

    } catch (error) {
      console.error('Droplist join error:', getErrorInfo(error))
      const errorInfo = getErrorInfo(error)
      setDroplistNotification(`Failed to join droplist: ${errorInfo.message}`)
      toast({
        title: "Error",
        description: `Failed to join droplist: ${errorInfo.message}`,
        variant: "destructive",
      })
    } finally {
      setIsJoiningDroplist(false)
    }
  }

  return (
    <header className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 relative z-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6">
        {/* Logo and Title with Mobile Menu Button */}
        <div className="flex justify-between items-center w-full lg:w-auto">
          <Link href="/">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex-shrink-0">
             
              <Image
                src="/logo.png"
                alt="FaucetDrops Logo"
                width={32}
                height={32}
                className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-md object-contain"
              />
             
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">
                FaucetDrops
              </h1>
              <div className="hidden sm:flex gap-1">
                <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Free, Fast, Fair & Frictionless
                </span>
                <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Token Distribution 💧
                </span>
              </div>
            </div>
          </div>
           </Link> 
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu Content */}
        <div className={`lg:hidden w-full z-50
          ${isMenuOpen ? 'block' : 'hidden'
        }`}>
          <div className="pt-4 space-y-4">
            <div className="flex flex-col space-y-3">
              <Button
                onClick={() => router.push('/create-faucet')}
                size="sm"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span>Create Faucet</span>
              </Button>

              <Button
                onClick={handleJoinDroplist}
                disabled={!isConnected || isJoiningDroplist}
                size="sm"
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
              >
                {isJoiningDroplist ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                <span>{isJoiningDroplist ? "Droplisting..." : "Join Droplist"}</span>
              </Button>
              
              <div className="py-1">
                <WalletConnectButton />
              </div>
              
              <div className="py-1">
                <NetworkSelector className='w-full' />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push('/create-faucet')}
              size="sm"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Create Faucet</span>
            </Button>

            <Button
              onClick={handleJoinDroplist}
              disabled={!isConnected || isJoiningDroplist}
              size="sm"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {isJoiningDroplist ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              <span>Join Droplist</span>
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <WalletConnectButton />
          </div>

          <div className="py-1">
            <NetworkSelector />
          </div>
        </div>
      </div>
      
      {/* Mobile menu backdrop */}
      {isMenuOpen && isMounted && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </header>
  )
}