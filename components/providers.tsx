"use client"

import * as React from "react"
import { useEffect } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { NetworkProvider } from "@/hooks/use-network"
import { WalletProvider } from "@/components/wallet-provider"
import { QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiAdapter, queryClient } from '@/config/appkit' // Ensure these imports match exports
import sdk from "@farcaster/miniapp-sdk"

export function Providers({ children }: { children: React.ReactNode }) {
  
  // Initialize Farcaster SDK
  useEffect(() => {
    const init = async () => {
      try {
        setTimeout(() => {
          sdk.actions.ready();
        }, 300);
      } catch (error) {
        console.warn("Failed to initialize Farcaster SDK", error);
      }
    };
    init();
  }, []);

  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="system" 
      enableSystem 
      disableTransitionOnChange
    >
      {/* FIX: Use wagmiAdapter directly, do not use .wagmiConfig */}
      <WagmiProvider config={wagmiAdapter}> 
        <QueryClientProvider client={queryClient}>
          <NetworkProvider>
            <WalletProvider>
              {children}
              <Toaster />
            </WalletProvider>
          </NetworkProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}