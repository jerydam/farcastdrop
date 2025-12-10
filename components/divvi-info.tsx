"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { useNetwork } from "@/hooks/use-network"
import { isCeloNetwork } from "@/lib/divvi-integration"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DivviInfo() {
  const { chainId } = useWallet()
  const { network } = useNetwork()
  const [isCelo, setIsCelo] = useState(false)

  useEffect(() => {
    if (chainId) {
      setIsCelo(isCeloNetwork(chainId))
    }
  }, [chainId])

  if (!isCelo) return null

  return (
    <Alert className="mb-4 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 border-green-200 dark:border-green-800">
      <div className="flex items-start">
        <div className="flex-1">
          <AlertTitle className="text-green-800 dark:text-green-400">Divvi Referral Active</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-500">
            Your transactions on Celo will include Divvi referral data, helping you earn rewards for driving on-chain
            activity.
          </AlertDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-2 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
          onClick={() => window.open("https://divvi.xyz", "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Learn More
        </Button>
      </div>
    </Alert>
  )
}
