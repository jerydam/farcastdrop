// File: app/page.tsx
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
import { FarcasterActions } from "@/components/farcaster-action" // Make sure you created this file!

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
  const { address, isConnected, signer, chainId } = useWallet()
  const { toast } = useToast()
  
  // Existing states
  const [currentNetwork, setCurrentNetwork] = useState<"celo" | "lisk" | null>(null)
  
  // Loading states
  const [isNavigatingToCreate, setIsNavigatingToCreate] = useState(false)
  const [isNavigatingToVerify, setIsNavigatingToVerify] = useState(false)
  
  // New droplist states
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

  return (
     <main className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
          {/* Header Section */}
          <Head />

          {/* User Info Card (Mobile & Farcaster Context) */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3 sm:p-4">
             {isConnected && address ? (
               <div className="flex flex-col gap-4">
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
                
                {/* Mobile/Card Farcaster Action Button */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <FarcasterActions />
                </div>
              </div>
             ) : (
              // If not connected, still show the Notification button (user might be in frame but not wallet connected yet)
              <div className="flex flex-col gap-2">
                 <p className="text-sm text-slate-500 text-center mb-2">Connect your wallet to manage faucets.</p>
                 <FarcasterActions />
              </div>
             )}
          </div>

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