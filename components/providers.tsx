"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { WalletProvider } from "@/components/wallet-provider"
import { useEffect } from "react"
import { sdk } from "@farcaster/miniapp-sdk"

export function Providers({ children }: { children: React.ReactNode }) {
  // Hide Farcaster splash screen as soon as possible
  useEffect(() => {
    sdk.actions.ready().catch(console.warn)
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <WalletProvider>
        {children}
        <Toaster />
      </WalletProvider>
    </ThemeProvider>
  )
}