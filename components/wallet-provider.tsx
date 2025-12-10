"use client"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { BrowserProvider, type JsonRpcSigner } from "ethers"
import { useToast } from "@/hooks/use-toast"
import { sdk } from "@farcaster/miniapp-sdk" // UPDATED: Only import sdk; isInMiniApp is sdk.isInMiniApp()

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
  sendBatchCalls: (calls: any[]) => Promise<void>
  getAuthToken: () => Promise<string | null>
}

const CELO_CHAIN_ID = 42220 // UPDATED: Celo-only; removed Base

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
  sendBatchCalls: async () => {},
  getAuthToken: async () => null,
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
    const initialize = async () => {
      try {
        console.log('[WalletProvider] Initializing...')

        // UPDATED: Use sdk.isInMiniApp() (async method, not import)
        const isMiniApp = await sdk.isInMiniApp()
        if (isMiniApp) {
          console.log('[WalletProvider] In MiniApp environment')
          // Await ready() to hide splash screen
          await sdk.actions.ready()
          
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

          console.log('✅ [WalletProvider] Farcaster wallet connected (Celo focus):', {
            address: userAddress,
            chainId: Number(network.chainId)
          })

          // Listen for changes
          farcasterProvider.on('chainChanged', (newChainId: string) => {
            console.log('[WalletProvider] Chain changed:', newChainId)
            setChainId(Number(newChainId))
          })
          farcasterProvider.on('accountsChanged', (accounts: string[]) => {
            console.log('[WalletProvider] Accounts changed:', accounts)
            if (accounts.length > 0) {
              setAddress(accounts[0])
            } else {
              // Handle disconnect
              setAddress(null)
              setIsReady(false)
            }
          })
        } else {
          // Fallback for non-MiniApp (standard browser wallet)
          console.log('[WalletProvider] In standard browser - manual connect required')
          toast({
            title: "Wallet Mode",
            description: "Connect manually in browser mode (Celo recommended)"
          })
          setIsReady(true) // Allow manual connect
        }
      } catch (error) {
        console.error('[WalletProvider] Initialization error:', error)
        toast({
          title: "Connection Error",
          description: "Failed to initialize wallet",
          variant: "destructive"
        })
      }
    }

    if (typeof window !== 'undefined') {
      initialize()
    }
  }, [toast])

  const connect = async () => {
    const isMiniApp = await sdk.isInMiniApp() // UPDATED: Use method here too
    if (isMiniApp) {
      // In MiniApp, auto-connect via SDK
      try {
        setIsConnecting(true)
        const farcasterProvider = sdk.wallet.getEthereumProvider()
        const accounts = await farcasterProvider.request({ method: 'eth_requestAccounts' })
        if (accounts && accounts.length > 0) {
          console.log('✅ [WalletProvider] Auto-connected (Celo):', accounts[0])
          toast({ title: "Connected", description: `Wallet: ${accounts[0].slice(0, 6)}...` })
        }
      } catch (error: any) {
        console.error('[WalletProvider] Auto-connect error:', error)
        toast({ title: "Connection Failed", description: error.message, variant: "destructive" })
      } finally {
        setIsConnecting(false)
      }
    } else {
      // In browser, prompt for standard connect (integrate with Wagmi if needed)
      toast({ title: "Browser Mode", description: "Use Wagmi for connection to Celo" })
    }
  }

  // Batch calls support for EIP-5792 (e.g., approve + claim faucet)
  const sendBatchCalls = async (calls: any[]) => {
    const isMiniApp = await sdk.isInMiniApp()
    if (!isMiniApp || !provider) return
    try {
      const farcasterProvider = sdk.wallet.getEthereumProvider()
      await farcasterProvider.request({
        method: 'wallet_sendCalls',
        params: [{ calls }]
      })
      toast({ title: "Batch Tx Sent", description: "Transactions confirmed on Celo" })
    } catch (error: any) {
      console.error('[WalletProvider] Batch tx error:', error)
      toast({ title: "Batch Tx Failed", description: error.message, variant: "destructive" })
    }
  }

  // Quick Auth for server sessions
  const getAuthToken = async () => {
    const isMiniApp = await sdk.isInMiniApp()
    if (!isMiniApp) return null
    try {
      const token = await sdk.quickAuth.getToken()
      console.log('[WalletProvider] Auth token fetched')
      return token
    } catch (error) {
      console.error('[WalletProvider] Auth error:', error)
      return null
    }
  }

  const switchChain = async (newChainId: number) => {
    // UPDATED: Celo-only; assume newChainId is CELO_CHAIN_ID
    try {
      console.log('[WalletProvider] Switching to Celo:', newChainId)
      const farcasterProvider = sdk.wallet.getEthereumProvider()
      await farcasterProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${newChainId.toString(16)}` }]
      })
      toast({ title: "Network Switched", description: "Now on Celo" })
    } catch (error: any) {
      if (error.code === 4902) {
        await addCeloNetwork()
      } else {
        console.error('[WalletProvider] Switch error:', error)
        toast({ title: "Network Switch Failed", description: error.message, variant: "destructive" })
        throw error
      }
    }
  }

  // UPDATED: Celo-only addNetwork
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
    toast({ title: "Network Added", description: "Celo network added to wallet" })
  }

  const ensureCorrectNetwork = async (requiredChainId: number): Promise<boolean> => {
    console.log('[WalletProvider] Ensuring Celo network:', { current: chainId, required: requiredChainId })
    if (!isReady) {
      await connect()
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    if (chainId !== requiredChainId) {
      try {
        await switchChain(requiredChainId)
        await new Promise(resolve => setTimeout(resolve, 1500))
        // Refresh chainId after switch
        if (provider) {
          const network = await provider.getNetwork()
          setChainId(Number(network.chainId))
        }
        return true
      } catch (error) {
        console.error('[WalletProvider] Network ensure failed:', error)
        return false
      }
    }
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
        sendBatchCalls,
        getAuthToken,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  
  useEffect(() => {
    console.log('[useWallet] State (Celo):', {
      address: context.address,
      isConnected: context.isConnected,
      chainId: context.chainId,
      hasProvider: !!context.provider,
      hasSigner: !!context.signer
    })
  }, [context])
  
  return context
}