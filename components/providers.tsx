"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { WalletProvider } from "@/components/wallet-provider"
import { NetworkProvider } from "@/hooks/use-network"
import { useEffect } from "react"
import { sdk } from "@farcaster/miniapp-sdk"

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    sdk.actions.ready().catch(() => {})
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <WalletProvider>
        <NetworkProvider>
          {children}
          <Toaster />
        </NetworkProvider>
      </WalletProvider>
    </ThemeProvider>
  )
}