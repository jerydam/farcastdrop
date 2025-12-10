"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { BrowserProvider, type JsonRpcSigner } from "ethers"
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
  ensureCorrectNetwork: (requiredChainId: number) => Promise<boolean>
  switchChain: (newChainId: number) => Promise<void>
}

const CELO_CHAIN_ID = 42220

export const WalletContext = createContext<WalletContextType>({
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  ensureCorrectNetwork: async () => false,
  switchChain: async () => {},
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const initializeFarcaster = async () => {
      try {
        console.log('[WalletProvider] Initializing Farcaster SDK...')
        
        // Initialize SDK
        sdk.actions.ready()
        
        // Get Farcaster provider
        const farcasterProvider = sdk.wallet.getEthereumProvider()
        
        // Wrap with Ethers
        const ethersProvider = new BrowserProvider(farcasterProvider as any)
        const ethersSigner = await ethersProvider.getSigner()
        const userAddress = await ethersSigner.getAddress()
        const network = await ethersProvider.getNetwork()

        setProvider(ethersProvider)
        setSigner(ethersSigner)
        setAddress(userAddress)
        setChainId(Number(network.chainId))
        setIsReady(true)

        console.log('✅ [WalletProvider] Farcaster wallet connected:', {
          address: userAddress,
          chainId: Number(network.chainId)
        })

        // Listen for chain changes
        farcasterProvider.on('chainChanged', (newChainId: string) => {
          console.log('[WalletProvider] Chain changed:', newChainId)
          setChainId(Number(newChainId))
        })

        // Listen for account changes
        farcasterProvider.on('accountsChanged', (accounts: string[]) => {
          console.log('[WalletProvider] Accounts changed:', accounts)
          if (accounts.length > 0) {
            setAddress(accounts[0])
          }
        })

      } catch (error) {
        console.error('[WalletProvider] Farcaster initialization error:', error)
        toast({
          title: "Connection Error",
          description: "Failed to connect to Farcaster wallet",
          variant: "destructive"
        })
      }
    }

    if (typeof window !== 'undefined') {
      initializeFarcaster()
    }
  }, [toast])

  const connect = async () => {
    try {
      setIsConnecting(true)
      const farcasterProvider = sdk.wallet.getEthereumProvider()
      
      // Request accounts (should be auto-approved in Farcaster)
      const accounts = await farcasterProvider.request({ method: 'eth_requestAccounts' })
      
      if (accounts && accounts.length > 0) {
        console.log('✅ [WalletProvider] Connected to Farcaster wallet:', accounts[0])
      }
      
    } catch (error: any) {
      console.error('[WalletProvider] Connect error:', error)
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const switchChain = async (newChainId: number) => {
    try {
      console.log('[WalletProvider] Switching to chain:', newChainId)
      const farcasterProvider = sdk.wallet.getEthereumProvider()
      
      await farcasterProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${newChainId.toString(16)}` }]
      })

      toast({
        title: "Network Switched",
        description: `Switched to chain ${newChainId}`
      })
    } catch (error: any) {
      // If chain doesn't exist, add it
      if (error.code === 4902) {
        try {
          await addCeloNetwork()
        } catch (addError: any) {
          console.error('[WalletProvider] Failed to add network:', addError)
          toast({
            title: "Network Switch Failed",
            description: addError.message,
            variant: "destructive"
          })
          throw addError
        }
      } else {
        console.error('[WalletProvider] Switch chain error:', error)
        toast({
          title: "Network Switch Failed",
          description: error.message,
          variant: "destructive"
        })
        throw error
      }
    }
  }

  const addCeloNetwork = async () => {
    const farcasterProvider = sdk.wallet.getEthereumProvider()
    
    await farcasterProvider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: `0x${CELO_CHAIN_ID.toString(16)}`,
        chainName: 'Celo',
        nativeCurrency: {
          name: 'CELO',
          symbol: 'CELO',
          decimals: 18
        },
        rpcUrls: ['https://forno.celo.org'],
        blockExplorerUrls: ['https://explorer.celo.org']
      }]
    })

    toast({
      title: "Network Added",
      description: "Celo network has been added to your wallet"
    })
  }

  const ensureCorrectNetwork = async (requiredChainId: number): Promise<boolean> => {
    console.log('[WalletProvider] Ensuring correct network:', {
      current: chainId,
      required: requiredChainId
    })

    if (!isReady) {
      console.log('[WalletProvider] Wallet not ready, connecting...')
      try {
        await connect()
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        console.error('[WalletProvider] Failed to connect:', error)
        return false
      }
    }

    if (chainId !== requiredChainId) {
      console.log(`[WalletProvider] Network mismatch: current=${chainId}, required=${requiredChainId}`)
      try {
        await switchChain(requiredChainId)
        await new Promise(resolve => setTimeout(resolve, 1500))
        return true
      } catch (error) {
        console.error('[WalletProvider] Failed to switch network:', error)
        return false
      }
    }

    console.log('✅ [WalletProvider] On correct network')
    return true
  }

  const isConnected = isReady && !!address && !!provider && !!signer

  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        address,
        chainId,
        isConnected,
        isConnecting,
        connect,
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
    console.log('[useWallet] State:', {
      address: context.address,
      isConnected: context.isConnected,
      chainId: context.chainId,
      hasProvider: !!context.provider,
      hasSigner: !!context.signer
    })
  }, [context])
  
  return context
}