"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useWallet } from "@/components/wallet-provider"
import { useNetwork } from "@/hooks/use-network" 
import { getUserFaucets } from "@/lib/faucet"
import {Header} from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
    Settings, 
    Plus, 
    Loader2, 
    Search, 
    Copy, 
    ExternalLink, 
    LayoutGrid, 
    List as ListIcon 
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns" // Optional: for date formatting

// --- Types ---
interface FaucetData {
    faucetAddress: string
    name: string
    chainId: number
    faucetType: string
    createdAt?: string
}

export default function DashboardPage() {
    const { address, isConnected } = useWallet()
    const { networks } = useNetwork()
    const router = useRouter()
    const { toast } = useToast()
    
    // State
    const [faucets, setFaucets] = useState<FaucetData[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [networkFilter, setNetworkFilter] = useState("all")
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid') // Toggle between grid/list on desktop

    // --- Data Fetching ---
    useEffect(() => {
        const fetchFaucets = async () => {
            if (!address) return
            setLoading(true)
            try {
                const data = await getUserFaucets(address)
                setFaucets(data)
            } catch (error) {
                console.error("Failed to load faucets", error)
                toast({ title: "Error", description: "Could not load your faucets.", variant: "destructive" })
            } finally {
                setLoading(false)
            }
        }

        if (isConnected && address) {
            fetchFaucets()
        } else {
            setLoading(false)
        }
    }, [address, isConnected, toast])

    // --- Helpers ---
    const getNetworkName = (chainId: number) => networks.find(n => n.chainId === chainId)?.name || `Chain ${chainId}`
    
    const getNetworkColor = (chainId: number) => {
        const net = networks.find(n => n.chainId === chainId)
        return net?.color || "#64748b" // Default slate color
    }

    const copyAddress = (addr: string) => {
        navigator.clipboard.writeText(addr)
        toast({ title: "Copied", description: "Address copied to clipboard" })
    }

    const handleManage = (faucet: FaucetData) => {
        router.push(`/faucet/${faucet.faucetAddress}?networkId=${faucet.chainId}`)
    }

    // --- Filtering Logic ---
    const filteredFaucets = useMemo(() => {
        return faucets.filter(faucet => {
            const matchesSearch = 
                faucet.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                faucet.faucetAddress.toLowerCase().includes(searchQuery.toLowerCase())
            
            const matchesNetwork = networkFilter === "all" || faucet.chainId.toString() === networkFilter

            return matchesSearch && matchesNetwork
        })
    }, [faucets, searchQuery, networkFilter])

    // --- Empty State Component ---
    if (!isConnected) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                 <Card className="w-full max-w-md text-center border-dashed">
                    <CardHeader>
                        <div className="mx-auto bg-muted p-4 rounded-full mb-4">
                            <LayoutGrid className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <CardTitle>Connect Wallet</CardTitle>
                        <CardDescription>Please connect your wallet to view your dashboard.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-background pb-20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
                <Header pageTitle="Dashboard" />

                {/* --- Action Bar --- */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Your Faucets</h1>
                        <p className="text-muted-foreground mt-1">Manage and monitor your token distributions across {networks.length} chains.</p>
                    </div>
                    <Button onClick={() => router.push("/create")} className="w-full md:w-auto">
                        <Plus className="h-4 w-4 mr-2" /> Create New Faucet
                    </Button>
                </div>

                {/* --- Filters & Controls --- */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by name or address..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={networkFilter} onValueChange={setNetworkFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="All Networks" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Networks</SelectItem>
                            {networks.map(n => (
                                <SelectItem key={n.chainId} value={n.chainId.toString()}>
                                    {n.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="hidden sm:flex bg-muted rounded-md p-1">
                        <Button 
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => setViewMode('list')}
                        >
                            <ListIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* --- Content Area --- */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading your faucets...</p>
                    </div>
                ) : filteredFaucets.length === 0 ? (
                    <Card className="border-dashed py-12">
                        <div className="flex flex-col items-center justify-center text-center space-y-4">
                            <div className="bg-muted p-4 rounded-full">
                                <Search className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-semibold text-lg">No faucets found</h3>
                                <p className="text-muted-foreground max-w-sm mx-auto">
                                    {searchQuery ? "Try adjusting your search or filters." : "Get started by deploying your first faucet on any supported chain."}
                                </p>
                            </div>
                            {!searchQuery && (
                                <Button onClick={() => router.push("/create")} variant="outline">
                                    Deploy Faucet
                                </Button>
                            )}
                        </div>
                    </Card>
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                        {filteredFaucets.map((faucet) => (
                            <FaucetCard 
                                key={faucet.faucetAddress} 
                                faucet={faucet} 
                                viewMode={viewMode}
                                getNetworkName={getNetworkName}
                                getNetworkColor={getNetworkColor}
                                onManage={() => handleManage(faucet)}
                                onCopy={() => copyAddress(faucet.faucetAddress)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </main>
    )
}

// --- Faucet Card Component (Handles both Grid and List view styles) ---
function FaucetCard({ 
    faucet, 
    viewMode, 
    getNetworkName, 
    getNetworkColor, 
    onManage, 
    onCopy 
}: { 
    faucet: FaucetData, 
    viewMode: 'grid' | 'list',
    getNetworkName: (id: number) => string,
    getNetworkColor: (id: number) => string,
    onManage: () => void,
    onCopy: () => void
}) {
    const networkName = getNetworkName(faucet.chainId)
    const networkColor = getNetworkColor(faucet.chainId)
    const dateCreated = faucet.createdAt ? new Date(faucet.createdAt).toLocaleDateString() : "N/A"

    if (viewMode === 'list') {
        return (
            <Card className="hover:shadow-md transition-shadow group">
                <div className="p-4 flex items-center gap-4">
                    {/* Icon Placeholder */}
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="font-bold text-primary">{faucet.name.charAt(0).toUpperCase()}</span>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <div>
                            <h3 className="font-semibold truncate">{faucet.name}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-mono truncate max-w-[100px]">{faucet.faucetAddress}</span>
                                <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="hover:text-foreground">
                                    <Copy className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-background" style={{ borderColor: networkColor, color: networkColor }}>
                                <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: networkColor }}></span>
                                {networkName}
                            </Badge>
                        </div>

                        <div>
                            <Badge variant="secondary" className="capitalize">{faucet.faucetType}</Badge>
                        </div>

                        <div className="text-xs text-muted-foreground hidden md:block">
                            Created: {dateCreated}
                        </div>
                    </div>

                    {/* Action */}
                    <Button onClick={onManage} size="sm" className="shrink-0">
                        <Settings className="h-4 w-4 mr-2" /> Manage
                    </Button>
                </div>
            </Card>
        )
    }

    // Grid View
    return (
        <Card className="hover:shadow-lg transition-all duration-200 group flex flex-col">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <Badge variant="outline" className="mb-2 w-fit bg-background" style={{ borderColor: networkColor, color: networkColor }}>
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: networkColor }}></span>
                        {networkName}
                    </Badge>
                    <Badge variant="secondary" className="capitalize text-xs">
                        {faucet.faucetType === 'dropcode' ? 'Drop Code' : faucet.faucetType === 'droplist' ? 'Drop List' : 'Custom'}
                    </Badge>
                </div>
                <CardTitle className="truncate text-lg">{faucet.name || "Untitled Faucet"}</CardTitle>
                <CardDescription className="font-mono text-xs flex items-center gap-2 mt-1">
                    {faucet.faucetAddress.slice(0, 6)}...{faucet.faucetAddress.slice(-4)}
                    <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="hover:text-foreground p-1 rounded hover:bg-muted transition-colors">
                        <Copy className="h-3 w-3" />
                    </button>
                    <a 
                        href="#" // In a real app, link to block explorer
                        className="hover:text-foreground p-1 rounded hover:bg-muted transition-colors ml-auto"
                        onClick={(e) => e.preventDefault()}
                    >
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-2">
                    <div className="bg-muted/50 p-2 rounded">
                        <span className="block font-semibold text-foreground">Created</span>
                        {dateCreated}
                    </div>
                    {/* Placeholder stats - could be real if backend returns them */}
                    <div className="bg-muted/50 p-2 rounded">
                        <span className="block font-semibold text-foreground">Chain ID</span>
                        {faucet.chainId}
                    </div>
                </div>
            </CardContent>
            <div className="p-4 pt-0 mt-auto">
                <Button onClick={onManage} className="w-full group-hover:bg-primary/90">
                    <Settings className="h-4 w-4 mr-2" /> Manage Faucet
                </Button>
            </div>
        </Card>
    )
}