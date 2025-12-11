"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { BrowserProvider, type JsonRpcSigner } from "ethers"
import sdk from "@farcaster/miniapp-sdk"
import { useToast } from "@/hooks/use-toast"

interface WalletContextType {
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  address: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void // In Farcaster, this is mostly a no-op or UI reset
  switchChain: (newChainId: number) => Promise<void>
  ensureCorrectNetwork: (requiredChainId: number) => Promise<boolean>
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
  switchChain: async () => {},
  ensureCorrectNetwork: async () => false,
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(true) // Start loading
  const { toast } = useToast()

  // Initialize Farcaster SDK
  useEffect(() => {
    const initFarcaster = async () => {
      try {
        // 1. Initialize SDK
        sdk.actions.ready()

        // 2. Check if we are in a Frame/MiniApp environment
        if (sdk.wallet) {
            const miniappProvider = sdk.wallet.getEthereumProvider()
            const ethersProvider = new BrowserProvider(miniappProvider as any)
            
            setProvider(ethersProvider)

            // 3. Get Network Data
            const network = await ethersProvider.getNetwork()
            setChainId(Number(network.chainId))

            // 4. Get Accounts (Auto-connect in Farcaster)
            const accounts = await ethersProvider.listAccounts()
            if (accounts.length > 0) {
                const ethersSigner = await ethersProvider.getSigner()
                setSigner(ethersSigner)
                setAddress(accounts[0].address)
            }
        } else {
            console.warn("Not running inside a Farcaster client")
        }
      } catch (error) {
        console.error("Farcaster SDK Init Error:", error)
      } finally {
        setIsConnecting(false)
      }
    }

    initFarcaster()
  }, [])

  // Handle Event Listeners (Chain changes, etc.)
  useEffect(() => {
    if (!provider) return

    // Note: Farcaster SDK provider might not emit standard EIP-1193 events perfectly 
    // depending on the client (Warpcast), but this is standard practice.
    const handleChainChanged = (newChainId: string) => {
        setChainId(parseInt(newChainId, 16))
        window.location.reload() // Recommended for chain changes to avoid state drift
    }

    const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length === 0) {
            setAddress(null)
            setSigner(null)
        } else {
            setAddress(accounts[0])
            const s = await provider.getSigner()
            setSigner(s)
        }
    }

    // Access the raw provider to add listeners
    // @ts-ignore - ethers wraps the provider
    if (provider.provider.on) {
        // @ts-ignore
        provider.provider.on('chainChanged', handleChainChanged)
        // @ts-ignore
        provider.provider.on('accountsChanged', handleAccountsChanged)
    }

    return () => {
        // @ts-ignore
        if (provider.provider.removeListener) {
            // @ts-ignore
            provider.provider.removeListener('chainChanged', handleChainChanged)
             // @ts-ignore
            provider.provider.removeListener('accountsChanged', handleAccountsChanged)
        }
    }
  }, [provider])

  const connect = async () => {
    if (!provider) return
    setIsConnecting(true)
    try {
      await provider.send("eth_requestAccounts", [])
      const signer = await provider.getSigner()
      setSigner(signer)
      setAddress(await signer.getAddress())
    } catch (error: any) {
      console.error(error)
      toast({ title: "Connection Error", description: error.message, variant: "destructive" })
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    // In Farcaster, you can't really "disconnect" the user since the wallet is 
    // part of the app shell, but we can clear local state.
    setSigner(null)
    setAddress(null)
  }

  const switchChain = async (newChainId: number) => {
    if (!provider) return
    try {
      const hexChainId = "0x" + newChainId.toString(16)
      await provider.send("wallet_switchEthereumChain", [{ chainId: hexChainId }])
      setChainId(newChainId)
      toast({ title: "Network Switched", description: `Connected to chain ID ${newChainId}` })
    } catch (error: any) {
        // Error code 4902 means the chain hasn't been added to the wallet.
        // Farcaster clients usually support major chains by default.
        toast({ title: "Switch Failed", description: error.message, variant: "destructive" })
        throw error
    }
  }

  const ensureCorrectNetwork = async (requiredChainId: number): Promise<boolean> => {
     if (!chainId) return false
     if (chainId === requiredChainId) return true
     
     try {
        await switchChain(requiredChainId)
        return true
     } catch (e) {
        return false
     }
  }

  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        address,
        chainId,
        isConnected: !!address && !!signer,
        isConnecting,
        connect,
        disconnect,
        switchChain,
        ensureCorrectNetwork
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}