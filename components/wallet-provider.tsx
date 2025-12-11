"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { BrowserProvider, type JsonRpcSigner } from "ethers"
import { useDisconnect, useSwitchChain, useAccount, useChainId, useConnect } from 'wagmi'
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
  
  const { address, isConnected: wagmiConnected, isConnecting } = useAccount()
  const chainId = useChainId()

  // Check if running in Farcaster frame
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sdk.actions.ready()
        if (sdk.wallet) {
          setIsFarcaster(true)
          console.log('✅ Running in Farcaster MiniApp')
        }
      } catch (e) {
        console.log('Not in Farcaster environment')
      }
    }
  }, [])

  // CRITICAL FIX: Setup provider/signer for both Farcaster and regular wallets
  useEffect(() => {
    const updateProviderAndSigner = async () => {
      if (wagmiConnected && address) {
        try {
          let ethersProvider: BrowserProvider
          
          // Use Farcaster's provider if in MiniApp, otherwise use window.ethereum
          if (isFarcaster && sdk.wallet) {
            console.log('[WalletProvider] Using Farcaster SDK provider')
            const farcasterProvider = sdk.wallet.getEthereumProvider()
            ethersProvider = new BrowserProvider(farcasterProvider)
          } else if (window.ethereum) {
            console.log('[WalletProvider] Using window.ethereum provider')
            ethersProvider = new BrowserProvider(window.ethereum)
          } else {
            throw new Error('No Ethereum provider found')
          }

          const ethersSigner = await ethersProvider.getSigner()
          
          setProvider(ethersProvider)
          setSigner(ethersSigner)
          setIsReady(true)
          
          console.log('✅ [WalletProvider] Wallet connected successfully:', { 
            address, 
            chainId,
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
        console.log('[WalletProvider] Wallet disconnected or missing dependencies. Clearing state.')
        setProvider(null)
        setSigner(null)
        setIsReady(false)
      }
    }

    updateProviderAndSigner()
  }, [wagmiConnected, address, chainId, isFarcaster])

  // Connect function
  const connect = async () => {
    if (isFarcaster && sdk.wallet) {
      // Farcaster handles connection automatically, just request accounts
      try {
        const provider = sdk.wallet.getEthereumProvider()
        await provider.request({ method: 'eth_requestAccounts' })
        console.log('✅ Farcaster wallet connected')
      } catch (error: any) {
        console.error('❌ Farcaster connection failed:', error)
        toast({ 
          title: "Connection failed", 
          description: error.message, 
          variant: "destructive" 
        })
      }
    } else {
      // Standard Wagmi connect for non-Farcaster
      try {
        await connectAsync()
        console.log('✅ Standard wallet connected')
      } catch (error: any) {
        console.error('❌ Connection failed:', error)
        toast({ 
          title: "Connection failed", 
          description: error.message, 
          variant: "destructive" 
        })
      }
    }
  }

  // Stable connection state
  const isConnected = wagmiConnected && !!address && !!provider && !!signer

  useEffect(() => {
    console.log('🔄 [WalletProvider] State update:', {
      isConnected,
      isConnecting,
      wagmiConnected,
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
      chainId,
      hasProvider: !!provider,
      hasSigner: !!signer,
      isReady,
      isFarcaster
    })
  }, [isConnected, isConnecting, wagmiConnected, address, chainId, provider, signer, isReady, isFarcaster])

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
      
      if (isFarcaster && sdk.wallet) {
        // Use Farcaster's provider for chain switching
        const farcasterProvider = sdk.wallet.getEthereumProvider()
        await farcasterProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${newChainId.toString(16)}` }],
        })
      } else {
        // Use Wagmi for standard wallets
        await wagmiSwitchChain({ chainId: newChainId })
      }
      
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
      console.log('Wallet not connected, opening connection modal...')
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