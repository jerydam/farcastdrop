// config/appkit.ts
"use client"

import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { arbitrum, mainnet, base, celo, type AppKitNetwork } from '@reown/appkit/networks'
import { QueryClient } from '@tanstack/react-query'
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector"; // <--- Import this

// ... (Keep your project ID check) ...
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '83d474a1874af18893a31155e04adad0'

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// ... (Keep your Lisk definition) ...
const lisk = {
  id: 1135,
  name: 'Lisk',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.api.lisk.com'] }
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://blockscout.lisk.com' }
  }
} as const

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  arbitrum, 
  base,
  celo,
  lisk
]

// Set up the Wagmi Adapter with the Farcaster Connector
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  connectors: [farcasterMiniApp()] 
})

// ... (Keep metadata) ...
const metadata = {
  name: 'Faucetdrops',
  description: 'Free, Fast, Fair & Frictionless Token Distribution 💧',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://faucetdrops.com',
  icons: [typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : 'https://faucetdrops.com/logo.png']
}

export const queryClient = new QueryClient()

export const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  metadata,
  projectId,
  features: {
    analytics: true,
    email: true,
    socials: ['google', 'github', 'apple', 'facebook', 'x', 'discord', 'farcaster']
  },
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#3b82f6'
  }
})