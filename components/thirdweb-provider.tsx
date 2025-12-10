"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { ThirdwebProvider as ThirdwebSDKProvider } from "thirdweb/react"
import { createThirdwebClient } from "thirdweb"
import { inAppWallet, createWallet } from "thirdweb/wallets"
import { useActiveAccount, useActiveWallet, useConnect, useDisconnect } from "thirdweb/react"

// Create Thirdweb client
export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!, // Add your client ID to env variables
})

// Define supported wallets
const wallets = [
  inAppWallet({
    auth: {
      options: [
        "google",
        "discord",
        "telegram",
        "farcaster",
        "email",
        "x",
        "passkey",
        "phone",
        "facebook",
        "guest",
      ],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
  createWallet("com.okex.wallet"),
  createWallet("com.binance.wallet"),
  createWallet("com.bitget.web3"),
  createWallet("com.bybit"),
]

interface ThirdwebContextType {
  client: any
  wallets: any[]
  isThirdwebConnected: boolean
  thirdwebAddress: string | null
  connectThirdweb: () => Promise<void>
  disconnectThirdweb: () => Promise<void>
  switchToSmartWallet: () => Promise<void>
  isSmartWallet: boolean
}

const ThirdwebContext = createContext<ThirdwebContextType>({
  client,
  wallets,
  isThirdwebConnected: false,
  thirdwebAddress: null,
  connectThirdweb: async () => {},
  disconnectThirdweb: async () => {},
  switchToSmartWallet: async () => {},
  isSmartWallet: false,
})

// Inner component that uses Thirdweb hooks
function ThirdwebContextProvider({ children }: { children: ReactNode }) {
  const [isSmartWallet, setIsSmartWallet] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  const isThirdwebConnected = !!account
  const thirdwebAddress = account?.address || null

  // Check if current wallet is a smart wallet
  useEffect(() => {
    if (wallet) {
      // You can customize this logic based on how you detect smart wallets
      const walletId = wallet.id
      setIsSmartWallet(walletId.includes('smart') || walletId.includes('account-abstraction'))
    } else {
      setIsSmartWallet(false)
    }
  }, [wallet])

  const connectThirdweb = async () => {
    if (isConnecting) return
    
    try {
      setIsConnecting(true)
      console.log("Starting wallet connection...")
      
      // Create a fresh wallet instance for connection
      const defaultWallet = inAppWallet({
        auth: {
          options: [
            "google",
            "discord", 
            "telegram",
            "farcaster",
            "email",
            "x",
            "passkey",
            "phone",
            "facebook",
            "guest",
          ],
        },
      })
      
      // Connect with proper error handling
      const connectedWallet = await connect(async () => {
        console.log("Creating wallet connection...")
        return defaultWallet
      })
      
      console.log("Wallet connected successfully:", connectedWallet)
      
    } catch (error: any) {
      console.error("Failed to connect Thirdweb wallet:", error)
      
      // More specific error handling
      if (error.message?.includes('User rejected')) {
        throw new Error("Connection was cancelled by user")
      } else if (error.message?.includes('without an account')) {
        throw new Error("Failed to establish wallet account. Please try again.")
      } else {
        throw new Error(error.message || "Failed to connect wallet")
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectThirdweb = async () => {
    try {
      if (wallet) {
        await disconnect(wallet)
        console.log("Wallet disconnected successfully")
      }
    } catch (error) {
      console.error("Failed to disconnect Thirdweb wallet:", error)
      throw error
    }
  }

  const switchToSmartWallet = async () => {
    try {
      // This is a placeholder - you'll need to implement smart wallet switching
      // based on your specific smart wallet setup (e.g., Account Abstraction)
      console.log("Switching to smart wallet...")
      
      // Example implementation:
      // 1. Disconnect current wallet
      // 2. Connect to smart wallet with same account
      // await disconnectThirdweb()
      // const smartWallet = smartWallet({ ... })
      // await connect(async () => smartWallet)
      
      throw new Error("Smart wallet switching not yet implemented")
    } catch (error) {
      console.error("Failed to switch to smart wallet:", error)
      throw error
    }
  }

  return (
    <ThirdwebContext.Provider
      value={{
        client,
        wallets,
        isThirdwebConnected,
        thirdwebAddress,
        connectThirdweb,
        disconnectThirdweb,
        switchToSmartWallet,
        isSmartWallet,
      }}
    >
      {children}
    </ThirdwebContext.Provider>
  )
}

// Main provider component
export function ThirdwebProvider({ children }: { children: ReactNode }) {
  return (
    <ThirdwebSDKProvider>
      <ThirdwebContextProvider>
        {children}
      </ThirdwebContextProvider>
    </ThirdwebSDKProvider>
  )
}

// Hook to use the Thirdweb context
export function useThirdweb() {
  const context = useContext(ThirdwebContext)
  if (context === undefined) {
    throw new Error('useThirdweb must be used within a ThirdwebProvider')
  }
  return context
}