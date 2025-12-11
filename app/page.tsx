"use client"

import { useWallet } from "@/components/wallet-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, Zap, Users, Globe, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  const { address, isConnected } = useWallet()

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16 max-w-6xl text-center">
        {/* Hero */}
        <div className="mb-16">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
            FaucetDrops
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Create token faucets on Celo in seconds — directly inside Warpcast
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="p-8 hover:shadow-xl transition-shadow">
            <Zap className="h-12 w-12 mx-auto mb-4 text-primary" />
            <CardTitle>Instant Setup</CardTitle>
            <CardContent className="mt-4 text-muted">
              Deploy a faucet in under 30 seconds — no gas, no setup
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-shadow">
            <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
            <CardTitle>Community Ready</CardTitle>
            <CardContent className="mt-4 text-muted">
              Drop codes, whitelists, or custom claims — all in one place
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-shadow">
            <Globe className="h-12 w-12 mx-auto mb-4 text-primary" />
            <CardTitle>Live on Farcaster</CardTitle>
            <CardContent className="mt-4 text-muted">
              Works only inside Warpcast — the real social layer of crypto
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="max-w-2xl mx-auto">
          {isConnected ? (
            <div className="space-y-8">
              <div className="bg-card rounded-2xl p-8 border shadow-lg">
                <p className="text-lg mb-6">
                  Connected as
                </p>
                <code className="text-sm md:text-base bg-muted px-4 py-2 rounded-lg font-mono break-all block mb-8">
                  {address}
                </code>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild size="lg" className="w-full">
                    <Link href="/create-faucet">
                      <Wallet className="mr-2 h-5 w-5" />
                      Create Faucet
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="w-full">
                    <Link href="/faucet/dashboard">
                      My Faucets <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-2xl p-12 border-2 border-dashed">
              <Wallet className="h-20 w-20 mx-auto mb-6 text-muted-foreground" />
              <h2 className="text-3xl font-bold mb-4">
                Open in Warpcast
              </h2>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                This app only works inside the Warpcast app. Open this link there to connect your wallet and start creating faucets.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}