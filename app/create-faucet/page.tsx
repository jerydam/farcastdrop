"use client"

import { useState, useEffect, useCallback } from "react"
import { useWallet } from "@/components/wallet-provider"
import { useNetwork } from "@/hooks/use-network"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { createFaucet, checkFaucetNameExistsAcrossAllFactories } from "@/lib/faucet"
import { isAddress } from "ethers"
import { zeroAddress } from "viem"
import { formatUnits } from "ethers"

import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
  Loader2, Check, AlertTriangle, Info, ArrowRight, ArrowLeft,
  Globe, Shield, Settings, Coins, Upload, X, Image as ImageIcon
} from "lucide-react"

import {Header} from "@/components/header"
import LoadingPage from "@/components/loading"

const DEFAULT_FAUCET_IMAGE = "/default.jpeg"

type FaucetType = "open" | "gated" | "custom"

const FAUCET_TYPE_TO_FACTORY: Record<FaucetType, "dropcode" | "droplist" | "custom"> = {
  open: "dropcode",
  gated: "droplist",
  custom: "custom",
}

const CELO_TOKENS = [
  { address: zeroAddress, name: "Celo", symbol: "CELO", decimals: 18, isNative: true, logoUrl: "/celo.jpeg" },
  { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", name: "Celo Dollar", symbol: "cUSD", decimals: 18, logoUrl: "/cusd.png" },
  { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", name: "Celo", symbol: "CELO", decimals: 18, logoUrl: "/celo.jpeg" },
  { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", name: "Celo Euro", symbol: "cEUR", decimals: 18, logoUrl: "/ceur.png" },
  { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", name: "USD Coin", symbol: "USDC", decimals: 6, logoUrl: "/usdc.jpg" },
]

export default function CreateFaucetPage() {
  const { address, provider, isConnected } = useWallet()
  const { network, getFactoryAddress } = useNetwork()
  const { toast } = useToast()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [faucetType, setFaucetType] = useState<FaucetType | "">("")
  const [faucetName, setFaucetName] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [selectedToken, setSelectedToken] = useState(CELO_TOKENS[0].address)
  const [customTokenAddr, setCustomTokenAddr] = useState("")
  const [showCustomToken, setShowCustomToken] = useState(false)

  const [nameValidating, setNameValidating] = useState(false)
  const [nameAvailable, setNameAvailable] = useState(false)
  const [creating, setCreating] = useState(false)

  // Auto-fill description
  useEffect(() => {
    if (address && !description) {
      setDescription(`Token faucet on Celo by ${address.slice(0, 6)}...${address.slice(-4)}`)
    }
  }, [address, description])

  // Validate faucet name
  useEffect(() => {
    if (!faucetName || !provider || !faucetType) return

    const timer = setTimeout(async () => {
      setNameValidating(true)
      try {
        const result = await checkFaucetNameExistsAcrossAllFactories(provider, faucetName)
        setNameAvailable(!result.exists)
      } catch {
        setNameAvailable(false)
      }
      setNameValidating(false)
    }, 600)

    return () => clearTimeout(timer)
  }, [faucetName, provider, faucetType])

  const uploadImage = async (file: File): Promise<string> => {
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("https://fauctdrop-backend.onrender.com/upload-image", {
      method: "POST",
      body: form,
    })
    const data = await res.json()
    return data.imageUrl
  }

  const handleCreate = async () => {
    if (!faucetType || !faucetName || !address || !provider) return

    setCreating(true)
    try {
      const tokenAddr = showCustomToken && isAddress(customTokenAddr) ? customTokenAddr : selectedToken
      const factoryAddr = getFactoryAddress(FAUCET_TO_FACTORY[faucetType])

      const faucetAddr = await createFaucet(
        provider,
        factoryAddr,
        faucetName,
        tokenAddr,
        BigInt(42220),
        BigInt(42220),
        faucetType === "open", // use backend for dropcode
        faucetType === "custom"
      )

      // Save metadata
      if (imageUrl || description) {
        await fetch("https://fauctdrop-backend.onrender.com/faucet-metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            faucetAddress: faucetAddr,
            description: description || null,
            imageUrl: imageUrl || null,
            createdBy: address,
            chainId: 42220,
          }),
        })
      }

      toast({ title: "Faucet Created!", description: `Address: ${faucetAddr.slice(0,8)}...` })
      router.push(`/faucet/${faucetAddr}?networkId=42220`)
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md text-center p-8">
          <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
          <p className="text-muted-foreground">Open this app inside Warpcast to continue</p>
        </Card>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container max-w-4xl mx-auto px-4">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6">
          ← Back
        </Button>

        <Header pageTitle="Create Faucet" />

        <div className="flex justify-center gap-8 my-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${i <= step ? "bg-primary text-white" : "bg-muted"}`}>
                {i}
              </div>
              {i < 3 && <div className={`w-24 h-1 ${i < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="grid md:grid-cols-3 gap-6">
            <Card
              className={`cursor-pointer ${faucetType === "open" ? "border-primary ring-2 ring-primary" : ""}`}
              onClick={() => setFaucetType("open")}
            >
              <CardHeader>
                <Globe className="h-8 w-8 text-green-600 mb-2" />
                <CardTitle>Open Drop</CardTitle>
                <CardDescription>Anyone with a code can claim</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className={`cursor-pointer ${faucetType === "gated" ? "border-primary ring-2 ring-primary" : ""}`}
              onClick={() => setFaucetType("gated")}
            >
              <CardHeader>
                <Shield className="h-8 w-8 text-orange-600 mb-2" />
                <CardTitle>Whitelist Drop</CardTitle>
                <CardDescription>Only approved wallets</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className={`cursor-pointer ${faucetType === "custom" ? "border-primary ring-2 ring-primary" : ""}`}
              onClick={() => setFaucetType("custom")}
            >
              <CardHeader>
                <Settings className="h-8 w-8 text-purple-600 mb-2" />
                <CardTitle>Custom Drop</CardTitle>
                <CardDescription>Advanced rules & logic</CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Configure Your Faucet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Faucet Name</Label>
                <Input
                  placeholder="My Community Airdrop"
                  value={faucetName}
                  onChange={(e) => setFaucetName(e.target.value)}
                />
                {nameValidating && <p className="text-sm text-muted-foreground mt-1">Checking name...</p>}
                {faucetName && !nameValidating && nameAvailable && <p className="text-green-600 text-sm mt-1">Name available</p>}
              </div>

              <div>
                <Label>Token</Label>
                <Select value={selectedToken} onValueChange={(v) => {
                  if (v === "custom") setShowCustomToken(true)
                  else {
                    setSelectedToken(v)
                    setShowCustomToken(false)
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CELO_TOKENS.map(t => (
                      <SelectItem key={t.address} value={t.address}>
                        <div className="flex items-center gap-2">
                          <img src={t.logoUrl} className="w-5 h-5 rounded-full" />
                          {t.symbol} • {t.name}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom Token</SelectItem>
                  </SelectContent>
                </Select>
                {showCustomToken && (
                  <Input
                    placeholder="0x..."
                    className="mt-2"
                    value={customTokenAddr}
                    onChange={(e) => setCustomTokenAddr(e.target.value)}
                  />
                )}
              </div>

              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="Describe your faucet..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <Label>Image (optional)</Label>
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={() => document.getElementById("img")?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Upload
                  </Button>
                  <input
                    id="img"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const url = await uploadImage(file)
                        setImageUrl(url)
                      }
                    }}
                  />
                  {imageUrl && <img src={imageUrl || DEFAULT_FAUCET_IMAGE} className="h-20 w-20 rounded-lg object-cover" />}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Create</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span>Type:</span> <strong className="capitalize">{faucetType} Drop</strong></div>
                <div className="flex justify-between"><span>Name:</span> <strong>{faucetName}</strong></div>
                <div className="flex justify-between"><span>Token:</span> <strong>
                  {CELO_TOKENS.find(t => t.address === selectedToken)?.symbol || "Custom"}
                </strong></div>
                <div className="flex justify-between"><span>Network:</span> <strong>Celo</strong></div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                size="lg"
                className="w-full"
                onClick={handleCreate}
                disabled={creating || !nameAvailable}
              >
                {creating ? (
                  <>Creating...</>
                ) : (
                  "Create Faucet"
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        <div className="flex justify-between mt-8">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep(s => s - 1)}>
            ← Previous
          </Button>
          {step < 3 && (
            <Button
              disabled={!faucetType || (step === 2 && !faucetName) || (step === 2 && !nameAvailable)}
              onClick={() => setStep(s => s + 1)}
            >
              Next →
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}