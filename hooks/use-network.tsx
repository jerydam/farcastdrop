// hooks/use-network.ts  ← FARCASTER + CELO ONLY (2025 version)
"use client"

import { createContext, useContext } from "react"

export const celoNetwork = {
  name: "Celo",
  chainId: 42220,
  symbol: "CELO",
  rpcUrl: "https://forno.celo.org",
  blockExplorerUrl: "https://celoscan.io",
  color: "#35D07F",
  logoUrl: "/celo.png",
  factoryAddresses: [
    "0x17cFed7fEce35a9A71D60Fbb5CA52237103A21FB",
    "0xB8De8f37B263324C44FD4874a7FB7A0C59D8C58E",
    "0xc26c4Ea50fd3b63B6564A5963fdE4a3A474d4024",
    "0x9D6f441b31FBa22700bb3217229eb89b13FB49de",
    "0xE3Ac30fa32E727386a147Fe08b4899Da4115202f",
    "0xF8707b53a2bEc818E96471DDdb34a09F28E0dE6D",
    "0x8D1306b3970278b3AB64D1CE75377BDdf00f61da",
    "0x8cA5975Ded3B2f93E188c05dD6eb16d89b14aeA5",
    "0xc9c89f695C7fa9D9AbA3B297C9b0d86C5A74f534"
  ],
  factories: {
    droplist: "0xF8707b53a2bEc818E96471DDdb34a09F28E0dE6D",
    dropcode: "0x8D1306b3970278b3AB64D1CE75377BDdf00f61da",
    custom: "0x8cA5975Ded3B2f93E188c05dD6eb16d89b14aeA5"
  },
  tokenAddress: "0x471EcE3750Da237f93B8E339c536989b8978a438", // cUSD
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
} as const

interface NetworkContextType {
  network: typeof celoNetwork
  isCorrectNetwork: boolean
  ensureCorrectNetwork: () => Promise<void>
  getFactoryAddress: (type: 'dropcode' | 'droplist' | 'custom') => string
}

const NetworkContext = createContext<NetworkContextType>({
  network: celoNetwork,
  isCorrectNetwork: true,
  ensureCorrectNetwork: async () => {},
  getFactoryAddress: () => "",
})

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const { chainId, ensureCorrectNetwork } = useWallet()

  const isCorrectNetwork = chainId === celoNetwork.chainId

  const getFactoryAddress = (type: 'dropcode' | 'droplist' | 'custom') => {
    return celoNetwork.factories[type] || celoNetwork.factoryAddresses[celoNetwork.factoryAddresses.length - 1]
  }

  return (
    <NetworkContext.Provider value={{
      network: celoNetwork,
      isCorrectNetwork,
      ensureCorrectNetwork,
      getFactoryAddress,
    }}>
      {children}
    </NetworkContext.Provider>
  )
}

export const useNetwork = () => useContext(NetworkContext)