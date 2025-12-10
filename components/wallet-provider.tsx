"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { BrowserProvider, JsonRpcSigner } from "ethers"
import { useToast } from "@/hooks/use-toast"
import { sdk } from "@farcaster/miniapp-sdk"

interface WalletContextType {
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  address: string | null
  chainId: number | null
  isConnected: boolean
  ensureCorrectNetwork: () => Promise<void>
  sendBatchCalls: (calls: any[]) => Promise<void>
  getAuthToken: () => Promise<string | null>
}

const CELO_CHAIN_ID = 42220

const WalletContext = createContext<WalletContextType>({
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  isConnected: false,
  ensureCorrectNetwork: async () => {},
  sendBatchCalls: async () => {},
  getAuthToken: async () => null,
})

export const useWallet = () => useContext(WalletContext)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const init = async () => {
      try {
        const isMiniApp = await sdk.isInMiniApp()
        if (!isMiniApp) {
          toast({
            title: "Wrong Environment",
            description: "Open this app inside Warpcast",
            variant: "destructive",
          })
          return
        }

        const ethProvider = sdk.wallet.getEthereumProvider()
        const ethersProvider = new BrowserProvider(ethProvider as any)
        const ethersSigner = await ethersProvider.getSigner()
        const userAddress = await ethersSigner.getAddress()
        const network = await ethersProvider.getNetwork()

        setProvider(ethersProvider)
        setSigner(ethersSigner)
        setAddress(userAddress)
        setChainId(Number(network.chainId))

        toast({
          title: "Connected",
          description: `${userAddress.slice(0,6)}...${userAddress.slice(-4)} on Celo`,
        })

        // Listen for changes
        ethProvider.on("accountsChanged", (accounts: string[]) => {
          setAddress(accounts[0] || null)
        })
        ethProvider.on("chainChanged", (id: string) => {
          setChainId(parseInt(id, 16))
        })
      } catch (err: any) {
        toast({
          title: "Connection Failed",
          description: err.message || "Wallet not available",
          variant: "destructive",
        })
      }
    }

    init()
  }, [toast])

  const ensureCorrectNetwork = async () => {
    if (chainId === CELO_CHAIN_ID) return

    const ethProvider = sdk.wallet.getEthereumProvider()
    try {
      await ethProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xa4ec" }],
      })
    } catch (err: any) {
      if (err.code === 4902) {
        await ethProvider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xa4ec",
            chainName: "Celo Mainnet",
            nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
            rpcUrls: ["https://forno.celo.org"],
            blockExplorerUrls: ["https://explorer.celo.org"],
          }],
        })
      }
    }
  }

  const sendBatchCalls = async (calls: any[]) => {
    await sdk.wallet.getEthereumProvider().request({
      method: "wallet_sendCalls",
      params: [{ calls }],
    })
    toast({ title: "Batch Sent!" })
  }

  const getAuthToken = async () => {
    try {
      return await sdk.quickAuth.getToken()
    } catch {
      return null
    }
  }

  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        address,
        chainId,
        isConnected: !!address && !!provider,
        ensureCorrectNetwork,
        sendBatchCalls,
        getAuthToken,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}