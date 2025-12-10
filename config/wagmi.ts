"use client"
import { http, createConfig } from 'wagmi'
import { celo } from 'wagmi/chains' // UPDATED: Celo-only
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector"

// Safe connectors with env check
const connectors = typeof window !== 'undefined' ? [farcasterMiniApp()] : []

export const wagmiConfig = createConfig({
  chains: [celo], // UPDATED: Removed Base
  connectors, 
  transports: {
    [celo.id]: http('https://forno.celo.org') // Celo RPC only
  },
  ssr: true, 
})