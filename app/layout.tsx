"use client"

import type React from "react"
import { useEffect } from "react" // Import useEffect
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { NetworkProvider } from "@/hooks/use-network"
import { WalletProvider } from "@/components/wallet-provider"
import { Footer } from "@/components/footer"
import { QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiAdapter, queryClient } from '@/config/appkit'
import sdk from "@farcaster/miniapp-sdk" // 1. Import Farcaster SDK

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  
  // 2. Initialize Farcaster SDK on mount
  useEffect(() => {
    const init = async () => {
      try {
        // This tells Farcaster the app is ready to render.
        // If you don't call this, the user sees a permanent loading spinner.
        // We add a small delay to ensure React has painted the initial state.
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
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" />
        <title>FaucetDrops</title>
        <meta name="description" content="Token Drops Made Easy 💧" />
      </head>
      <body className={inter.className}>
        <ThemeProvider 
          attribute="class" 
          defaultTheme="system" 
          enableSystem 
          disableTransitionOnChange
        >
          <WagmiProvider config={wagmiAdapter.wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              <NetworkProvider>
                <WalletProvider>
                  <div className="min-h-screen flex flex-col">
                    <main className="flex-1">
                      {children}
                    </main>
                    <Footer />
                  </div>
                  <Toaster />
                </WalletProvider>
              </NetworkProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}