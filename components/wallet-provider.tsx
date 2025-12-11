"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { BrowserProvider, type JsonRpcSigner } from "ethers"
import { useDisconnect, useSwitchChain, useAccount, useChainId, useConnect, useConnectorClient } from 'wagmi'
import { useToast } from "@/hooks/use-toast"
import sdk from "@farcaster/miniapp-sdk"

interface WalletContextType {
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  address: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  ensureCorrectNetwork: (requiredChainId: number) => Promise<boolean>
  switchChain: (newChainId: number) => Promise<void>
}

export const WalletContext = createContext<WalletContextType>({
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  ensureCorrectNetwork: async () => false,
  switchChain: async () => {},
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isFarcaster, setIsFarcaster] = useState(false)
  const { toast } = useToast()
  
  const { connectAsync } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChain: wagmiSwitchChain } = useSwitchChain()
  
  const { address, isConnected: wagmiConnected, isConnecting, connector } = useAccount()
  const chainId = useChainId()
  
  // Get the connector client from Wagmi - THIS IS KEY
  const { data: connectorClient } = useConnectorClient()

  // Detect Farcaster environment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sdk.actions.ready()
        const context = sdk.context
        if (context?.client?.clientFid) {
          setIsFarcaster(true)
          console.log('✅ Running in Farcaster MiniApp, FID:', context.client.clientFid)
        }
      } catch (e) {
        console.log('Not in Farcaster environment')
      }
    }
  }, [])

  // CRITICAL FIX: Use Wagmi's connector client to create ethers provider
  useEffect(() => {
    const updateProviderAndSigner = async () => {
      if (wagmiConnected && address && connectorClient) {
        try {
          console.log('[WalletProvider] Creating provider from connector client:', {
            connector: connector?.name,
            address,
            chainId,
            isFarcaster
          })

          // Create ethers provider from Wagmi's connector client
          // This works for ALL connectors including Farcaster
          const ethersProvider = new BrowserProvider(connectorClient as any)
          const ethersSigner = await ethersProvider.getSigner()
          
          setProvider(ethersProvider)
          setSigner(ethersSigner)
          setIsReady(true)
          
          console.log('✅ [WalletProvider] Provider/Signer ready:', { 
            address, 
            chainId,
            connector: connector?.name,
            hasProvider: !!ethersProvider,
            hasSigner: !!ethersSigner,
            isFarcaster
          })
        } catch (error) {
          console.error('❌ [WalletProvider] Error setting up provider/signer:', error)
          setProvider(null)
          setSigner(null)
          setIsReady(false)
        }
      } else {
        console.log('[WalletProvider] Clearing state:', {
          wagmiConnected,
          hasAddress: !!address,
          hasConnectorClient: !!connectorClient
        })
        setProvider(null)
        setSigner(null)
        setIsReady(false)
      }
    }

    updateProviderAndSigner()
  }, [wagmiConnected, address, chainId, connectorClient, connector, isFarcaster])

  // Connect function
  const connect = async () => {
    try {
      console.log('Connecting wallet...')
      await connectAsync()
      console.log('✅ Wallet connected')
    } catch (error: any) {
      console.error('❌ Connection failed:', error)
      toast({ 
        title: "Connection failed", 
        description: error.message, 
        variant: "destructive" 
      })
    }
  }

  // Stable connection state
  const isConnected = wagmiConnected && !!address && !!provider && !!signer
  // Auto-switch to Celo on connect in Farcaster
useEffect(() => {
  const autoSwitchToCelo = async () => {
    if (isFarcaster && wagmiConnected && chainId !== 42220) {
      console.log('Auto-switching to Celo network...')
      await switchChain(42220)
    }
  }
  autoSwitchToCelo()
}, [isFarcaster, wagmiConnected, chainId])
  useEffect(() => {
    console.log('🔄 [WalletProvider] State:', {
      isConnected,
      isConnecting,
      wagmiConnected,
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
      chainId,
      connector: connector?.name,
      hasProvider: !!provider,
      hasSigner: !!signer,
      hasConnectorClient: !!connectorClient,
      isReady,
      isFarcaster
    })
  }, [isConnected, isConnecting, wagmiConnected, address, chainId, connector, provider, signer, connectorClient, isReady, isFarcaster])

  const disconnect = () => {
    try {
      console.log('Disconnecting wallet...')
      wagmiDisconnect()
      setProvider(null)
      setSigner(null)
      setIsReady(false)
      
      toast({
        title: "Wallet disconnected",
        description: "Your wallet has been disconnected",
      })
    } catch (error) {
      console.error("Error disconnecting:", error)
    }
  }

  const switchChain = async (newChainId: number) => {
    try {
      console.log('Switching to chain:', newChainId)
      await wagmiSwitchChain({ chainId: newChainId })
      
      toast({
        title: "Network switched",
        description: `Switched to chain ${newChainId}`,
      })
    } catch (error: any) {
      console.error("Failed to switch network:", error)
      toast({
        title: "Network switch failed",
        description: error.message || "Failed to switch network",
        variant: "destructive",
      })
      throw error
    }
  }

  const ensureCorrectNetwork = async (requiredChainId: number): Promise<boolean> => {
    console.log('Ensuring correct network:', { 
      current: chainId, 
      required: requiredChainId,
      isConnected 
    })
    
    if (!isConnected) {
      console.log('Wallet not connected, attempting to connect...')
      try {
        await connect()
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        console.error('Failed to connect wallet:', error)
        return false
      }
    }

    if (chainId !== requiredChainId) {
      console.log(`Network mismatch: current=${chainId}, required=${requiredChainId}`)
      try {
        await switchChain(requiredChainId)
        await new Promise(resolve => setTimeout(resolve, 1500))
        return true
      } catch (error) {
        console.error('Failed to switch network:', error)
        return false
      }
    }

    console.log('✅ On correct network')
    return true
  }

  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        address: address || null,
        chainId: chainId || null,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        ensureCorrectNetwork,
        switchChain,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  
  useEffect(() => {
    console.log('useWallet hook state:', {
      address: context.address,
      isConnected: context.isConnected,
      chainId: context.chainId,
      hasProvider: !!context.provider,
      hasSigner: !!context.signer
    })
  }, [context])
  
  return context
}