// File: app/page.tsx (or components/home.tsx - the main Home component)
"use client"

import { FaucetList } from "@/components/faucet-list"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { Contract } from "ethers"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { isSupportedNetwork } from "../lib/divvi-integration"
import { NetworkGrid } from "@/components/network"
import { useWallet } from "@/hooks/use-wallet"
import { useToast } from "@/hooks/use-toast"
import Head from "@/components/Head"


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

export default function Home() {
  const router = useRouter()
  const { address, isConnected, signer, chainId, ensureCorrectNetwork } = useWallet()
  const { toast } = useToast()
  
  // Existing states
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [checkInStatus, setCheckInStatus] = useState("")
  const [isAllowedAddress, setIsAllowedAddress] = useState(false)
  const [currentNetwork, setCurrentNetwork] = useState<"celo" | "lisk" | null>(null)
  
  // Loading states
  const [isNavigatingToCreate, setIsNavigatingToCreate] = useState(false)
  const [isNavigatingToVerify, setIsNavigatingToVerify] = useState(false)
  const [isNetworkSelectorLoading, setIsNetworkSelectorLoading] = useState(false)
  const [isJoiningDroplist, setIsJoiningDroplist] = useState(false)
  
  
  // New droplist states
  const [isDroplistOpen, setIsDroplistOpen] = useState(false)
  const [droplistNotification, setDroplistNotification] = useState<string | null>(null)

  // Handle navigation with loading
  const handleCreateFaucetClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsNavigatingToCreate(true)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay for UX
      router.push('/create-faucet')
    } catch (error) {
      console.error('Navigation error:', error)
      setIsNavigatingToCreate(false)
    }
  }

  const handleVerifyClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsNavigatingToVerify(true)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay for UX
      router.push('/verify')
    } catch (error) {
      console.error('Navigation error:', error)
      setIsNavigatingToVerify(false)
    }
  }

  // Handle droplist modal
  const handleDroplistClick = () => {
    setIsDroplistOpen(true)
    setDroplistNotification(null)
  }

  const handleDroplistClose = () => {
    setIsDroplistOpen(false)
  }

  // Handle network selector loading
  const handleNetworkSelectorChange = async (network: string) => {
    setIsNetworkSelectorLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate network switch
      setCurrentNetwork(network as "celo" | "lisk")
    } catch (error) {
      console.error('Network switch error:', error)
    } finally {
      setIsNetworkSelectorLoading(false)
    }
  }

  

  // Clean up event listener
  useEffect(() => {
    let contract: Contract | null = null
    if (isConnected && address && chainId && signer) {
      try {
        contract = new Contract(DROPLIST_CONTRACT_ADDRESS, CHECKIN_ABI, signer)
        const listener = (user: string, participantCount: bigint) => {
          if (user.toLowerCase() === address.toLowerCase()) {
            setDroplistNotification(`Joined droplist! Total participants: ${participantCount}`)
            toast({
              title: "Droplist Joined",
              description: `Total participants: ${participantCount}`,
            })
          }
        }
        contract.on("NewParticipant", listener)
        return () => {
          contract?.off("NewParticipant", listener)
        }
      } catch (error) {
        console.error('Error setting up event listener:', getErrorInfo(error))
      }
    }
  }, [isConnected, address, chainId, signer])

  // Reset navigation loading states
  useEffect(() => {
    const handleRouteChange = () => {
      setIsNavigatingToCreate(false)
      setIsNavigatingToVerify(false)
    }
    return () => {
      handleRouteChange()
    }
  }, [])

  // Show notification
  useEffect(() => {
    if (droplistNotification) {
      const timer = setTimeout(() => {
        setDroplistNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [droplistNotification])

  // Debug button state
  useEffect(() => {
    console.log('Button state:', { isConnected, isJoiningDroplist, disabled: !isConnected || isJoiningDroplist || !chainId || !isSupportedNetwork(chainId!), address, chainId })
  }, [isConnected, isJoiningDroplist, address, chainId])

  return (
     <main className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
          {/* Header Section */}
          <Head />

          {/* User Info Card (for mobile) */}
          {isConnected && address && (
            <div className="lg:hidden bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3 sm:p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Wallet</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono break-all">
                  {address}
                </p>
                {currentNetwork && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Network</span>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full capitalize whitespace-nowrap">
                      {currentNetwork}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <NetworkGrid />
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <AnalyticsDashboard /> 
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <FaucetList />
            </div>
          </div>
        </div>
      </div>      
    </main>
  )
}
