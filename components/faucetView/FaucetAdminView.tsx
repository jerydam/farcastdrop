"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import FaucetUserView from "./FaucetUserView"
import { useToast } from "@/hooks/use-toast"
import { formatUnits, parseUnits } from "ethers"

import {
    setWhitelistBatch, setCustomClaimAmountsBatch, resetAllClaims, fundFaucet, withdrawTokens,
    setClaimParameters, addAdmin, removeAdmin, getFaucetTransactionHistory, updateFaucetName, deleteFaucet
} from "@/lib/faucet"
import { retrieveSecretCode } from "@/lib/backend-service"

type FaucetType = "dropcode" | "droplist" | "custom"

interface SocialMediaLink {
    platform: string
    url: string
    handle: string
    action: string
}

interface FaucetAdminViewProps {
    faucetAddress: string
    faucetDetails: any
    faucetType: FaucetType | null
    tokenSymbol: string
    tokenDecimals: number
    selectedNetwork: any
    adminList: string[]
    isOwner: boolean
    backendMode: boolean
    loadFaucetDetails: () => Promise<void>
    checkNetwork: (skipToast?: boolean) => boolean
    dynamicTasks: SocialMediaLink[]
    newSocialLinks: SocialMediaLink[]
    setNewSocialLinks: React.Dispatch<React.SetStateAction<SocialMediaLink[]>>
    customXPostTemplate: string
    setCustomXPostTemplate: React.Dispatch<React.SetStateAction<string>>
    transactions: any[]
    setTransactions: React.Dispatch<React.SetStateAction<any[]>>
    address: string | null
    chainId: number | null
    provider: any
    handleGoBack: () => void
    router: any
}

export default function FaucetAdminView({
    faucetAddress,
    faucetDetails,
    faucetType,
    tokenSymbol,
    tokenDecimals,
    selectedNetwork,
    adminList,
    isOwner,
    backendMode,
    loadFaucetDetails,
    checkNetwork,
    dynamicTasks,
    newSocialLinks,
    setNewSocialLinks,
    customXPostTemplate,
    setCustomXPostTemplate,
    transactions,
    setTransactions,
    address,
    chainId,
    provider,
    handleGoBack,
    router,
}: FaucetAdminViewProps) {
    const { toast } = useToast()

    const [activeTab, setActiveTab] = useState("fund")
    const [fundAmount, setFundAmount] = useState("")
    const [withdrawAmount, setWithdrawAmount] = useState("")
    const [claimAmount, setClaimAmount] = useState(formatUnits(faucetDetails.claimAmount || 0n, tokenDecimals))
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    const [whitelistAddresses, setWhitelistAddresses] = useState("")
    const [isWhitelistEnabled, setIsWhitelistEnabled] = useState(true)
    const [showFundPopup, setShowFundPopup] = useState(false)
    const [adjustedFundAmount, setAdjustedFundAmount] = useState("")
    const [showEditNameDialog, setShowEditNameDialog] = useState(false)
    const [newFaucetName, setNewFaucetName] = useState(faucetDetails.name || "")
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [newAdminAddress, setNewAdminAddress] = useState("")
    const [isAddingAdmin, setIsAddingAdmin] = useState(true)
    const [showAddAdminDialog, setShowAddAdminDialog] = useState(false)
    const [currentSecretCode, setCurrentSecretCode] = useState("")
    const [showCurrentSecretDialog, setShowCurrentSecretDialog] = useState(false)
    const [newlyGeneratedCode, setNewlyGeneratedCode] = useState("")
    const [showNewCodeDialog, setShowNewCodeDialog] = useState(false)
    const [showPreview, setShowPreview] = useState(false)

    useEffect(() => {
        if (faucetDetails) {
            setClaimAmount(formatUnits(faucetDetails.claimAmount || 0n, tokenDecimals))
            setStartTime(faucetDetails.startTime ? new Date(Number(faucetDetails.startTime) * 1000).toISOString().slice(0, 16) : "")
            setEndTime(faucetDetails.endTime ? new Date(Number(faucetDetails.endTime) * 1000).toISOString().slice(0, 16) : "")
            setNewFaucetName(faucetDetails.name || "")
        }
    }, [faucetDetails, tokenDecimals])

    const loadHistory = useCallback(async () => {
        const txs = await getFaucetTransactionHistory(provider, faucetAddress, selectedNetwork, faucetType)
        setTransactions(txs.sort((a, b) => b.timestamp - a.timestamp))
    }, [provider, faucetAddress, selectedNetwork, faucetType, setTransactions])

    useEffect(() => {
        if (activeTab === "history") loadHistory()
    }, [activeTab, loadHistory])

    const saveTasks = async (tasks: any[]) => {
        await fetch("https://fauctdrop-backend.onrender.com/add-faucet-tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ faucetAddress, tasks, userAddress: address, chainId: Number(chainId) }),
        })
        setNewSocialLinks([])
        loadFaucetDetails()
    }

    const handleUpdateParameters = async () => {
        const combinedTasks = [...dynamicTasks, ...newSocialLinks]
        if (newSocialLinks.length > 0) await saveTasks(combinedTasks)

        const claimBN = parseUnits(claimAmount, tokenDecimals)
        const start = Math.floor(new Date(startTime).getTime() / 1000)
        const end = Math.floor(new Date(endTime).getTime() / 1000)
        await setClaimParameters(provider, faucetAddress, claimBN, start, end, BigInt(chainId || 42220), BigInt(selectedNetwork.chainId), faucetType || "dropcode")
        loadFaucetDetails()
        loadHistory()
    }

    const handleFund = async () => {
        await fundFaucet(provider, faucetAddress, parseUnits(fundAmount, tokenDecimals), faucetDetails.isEther, BigInt(chainId || 42220), BigInt(selectedNetwork.chainId), faucetType || "dropcode")
        setFundAmount("")
        loadFaucetDetails()
        loadHistory()
    }

    // ... Add similar simplified handlers for withdraw, whitelist, etc.

    return (
        <Card>
            <CardHeader>
                <CardTitle>Admin View</CardTitle>
            </CardHeader>
            <CardContent>
                {/* Simplified tabs and forms */}
            </CardContent>
        </Card>
    )
}