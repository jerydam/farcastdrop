"use client"

import { http, createConfig } from 'wagmi'
import { celo } from 'wagmi/chains'
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector"

// Helper to safely get connectors
const connectors = typeof window !== 'undefined' ? [farcasterMiniApp()] : []

export const wagmiConfig = createConfig({
  chains: [celo],
  connectors, 
  transports: {
    [celo.id]: http()
  },
  // Ensure we don't try to hydrate connections on the server if they don't exist
  ssr: true, 
})