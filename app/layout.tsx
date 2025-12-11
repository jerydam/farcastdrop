"use client"

import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { WalletProvider } from "@/components/wallet-provider" // This must be your NEW Farcaster-only provider
import { Footer } from "@/components/footer"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  
  // Note: We removed the useEffect for sdk.actions.ready() here 
  // because we moved that logic into your new WalletProvider.

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
          {/* Simplified Provider Tree:
            - Removed WagmiProvider (Not needed for Farcaster-only)
            - Removed QueryClientProvider (Not needed for Wallet)
            - Removed NetworkProvider (State now lives in WalletProvider)
          */}
          <WalletProvider>
            <div className="min-h-screen flex flex-col">
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
            <Toaster />
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}