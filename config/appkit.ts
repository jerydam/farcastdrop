// config/wagmi.ts
"use client"

import { http, createConfig } from 'wagmi'
import { celo } from 'wagmi/chains'
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector"

// Create Wagmi config with only Farcaster connector and Celo chain
export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [farcasterMiniApp()],
  transports: {
    [celo.id]: http()
  },
  ssr: true
})