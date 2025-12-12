import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, AlertCircle, Clock, Copy, ArrowLeft, Link, Download, Share2, ExternalLink, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TokenBalance } from "@/components/token-balance";
import { formatUnits } from 'ethers';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"; // Necessary for handleCopyFaucetLink

// Helper functions (could be moved to a separate utils file)
const getPlatformIcon = (platform: string): string => {
  switch(platform.toLowerCase()) {
    case 'telegram': return '📱'
    case 'discord': return '💬'
    case '𝕏': case 'x': return '𝕏'
    case 'youtube': return '📺'
    case 'instagram': return '📷'
    case 'tiktok': return '🎵'
    case 'facebook': return '📘'
    default: return '🔗'
  }
}

const getActionText = (platform: string): string => {
  switch(platform.toLowerCase()) {
    case 'telegram': return 'Join'
    case 'discord': return 'Join'
    case '𝕏': case 'x': return 'Follow'
    case 'youtube': return 'Subscribe'
    case 'instagram': return 'Follow'
    default: return 'Follow'
  }
}

const handleCopyFaucetLink = async (toast: any): Promise<void> => {
    try {
        const currentUrl = window.location.href
        await navigator.clipboard.writeText(currentUrl)
        toast({ title: "Link Copied", description: "Faucet link has been copied to your clipboard.", })
    } catch (error) {
        toast({ title: "Copy Failed", description: "Failed to copy the link. Please try again.", variant: "destructive", })
    }
}

// --- Component Props and Definition ---
interface SocialMediaLink {
    platform: string;
    url: string;
    handle: string;
    action: string;
}

interface FaucetUserViewProps {
    faucetAddress: string;
    faucetDetails: any;
    faucetType: 'dropcode' | 'droplist' | 'custom' | null;
    tokenSymbol: string;
    tokenDecimals: number;
    selectedNetwork: any;
    address: string | null;
    isConnected: boolean;
    hasClaimed: boolean;
    userIsWhitelisted: boolean;
    hasCustomAmount: boolean;
    userCustomClaimAmount: bigint;
    dynamicTasks: SocialMediaLink[];
    allAccountsVerified: boolean;
    secretCode: string;
    setSecretCode: (code: string) => void;
    usernames: Record<string, string>;
    setUsernames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    verificationStates: Record<string, boolean>;
    setVerificationStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    isVerifying: boolean;
    faucetMetadata: {description?: string, imageUrl?: string};
    customXPostTemplate: string;
    handleBackendClaim: () => Promise<void>;
    handleFollowAll: () => void;
    generateXPostContent: (amount: string) => string;
    txHash: string | null;
    showFollowDialog: boolean;
    setShowFollowDialog: (open: boolean) => void;
    showVerificationDialog: boolean;
    setShowVerificationDialog: (open: boolean) => void;
    showClaimPopup: boolean;
    setShowClaimPopup: (open: boolean) => void;
    handleVerifyAllTasks: () => Promise<void>;
    handleGoBack: () => void; // <-- ADDED: Router fix
}

const FaucetUserView: React.FC<FaucetUserViewProps> = ({
    faucetDetails,
    faucetType,
    tokenSymbol,
    tokenDecimals,
    selectedNetwork,
    address,
    hasClaimed,
    userIsWhitelisted,
    hasCustomAmount,
    userCustomClaimAmount,
    dynamicTasks,
    allAccountsVerified,
    secretCode,
    setSecretCode,
    usernames,
    setUsernames,
    verificationStates,
    isVerifying,
    faucetMetadata,
    handleBackendClaim,
    handleFollowAll,
    generateXPostContent,
    txHash,
    showFollowDialog,
    setShowFollowDialog,
    showVerificationDialog,
    setShowVerificationDialog,
    showClaimPopup,
    setShowClaimPopup,
    handleVerifyAllTasks,
    handleGoBack, // <-- ADDED: Destructure new prop
}) => {
    const { toast } = useToast();

    const canClaim = (() => {
        if (!faucetDetails?.isClaimActive || hasClaimed || !allAccountsVerified) {
          return false
        }
        switch (faucetType) {
          case 'dropcode':
            return faucetDetails.backendMode ? secretCode.length === 6 && /^[A-Z0-9]{6}$/.test(secretCode) : true
          case 'droplist':
            return userIsWhitelisted
          case 'custom':
            return hasCustomAmount && userCustomClaimAmount > 0
          default:
            return false
        }
    })();

    const claimedAmount = faucetType === 'custom' && hasCustomAmount
        ? formatUnits(userCustomClaimAmount, tokenDecimals)
        : faucetDetails?.claimAmount
        ? formatUnits(faucetDetails.claimAmount, tokenDecimals)
        : "0"

    const shouldShowSecretCodeInput = faucetType === 'dropcode' && faucetDetails?.backendMode;

    const handleShareOnX = (): void => {
        const shareText = encodeURIComponent(generateXPostContent(claimedAmount))
        const shareUrl = `https://x.com/intent/tweet?text=${shareText}`
        window.open(shareUrl, "_blank")
        setShowClaimPopup(false)
    }

    const getAllUsernamesProvided = (): boolean => {
      if (dynamicTasks.length === 0) return true
      return dynamicTasks.every(task => usernames[task.platform] && usernames[task.platform].trim().length > 0)
    }
    
    // Countdown logic (simplified for view)
    const renderCountdown = (timestamp: number, prefix: string): string => {
        if (timestamp === 0) return "N/A"
        const diff = timestamp * 1000 - Date.now()
        if (diff <= 0) return prefix === "Start" ? "Active" : "Ended"

        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        return `${days}d ${hours}h ${minutes}m ${seconds}s ${prefix === "Start" ? "until active" : "until inactive"}`
    }

    return (
        <>
            <div className="flex flex-row justify-between items-start sm:items-center gap-4">
                <Button
                    variant="outline"
                    onClick={handleGoBack} // <-- USED PROP
                    className="text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground"
                >
                    <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Back
                </Button>
                <Button
                    variant="outline"
                    onClick={() => handleCopyFaucetLink(toast)}
                    className="text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground"
                >
                    <Link className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Copy Faucet Link
                </Button>
            </div>

            <Card className="w-full mx-auto">
                <CardHeader className="px-4 sm:px-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <CardTitle className="text-lg sm:text-xl">{faucetDetails.name || tokenSymbol} Faucet</CardTitle>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {selectedNetwork && (<Badge style={{ backgroundColor: selectedNetwork.color }} className="text-white text-xs px-2 py-1">{selectedNetwork.name}</Badge>)}
                            {faucetType && (<Badge variant="default" className="capitalize">{faucetType === 'dropcode' ? 'DropCode' : faucetType === 'droplist' ? 'DropList' : 'Custom'}</Badge>)}
                            {faucetDetails.isClaimActive ? (<span className="text-xs bg-green-500/20 text-green-600 px-2 py-1 rounded-full">Active</span>) : (<span className="text-xs bg-red-500/20 text-red-600 px-2 py-1 rounded-full">Inactive</span>)}
                        </div>
                    </div>
                    {(faucetMetadata.imageUrl || faucetMetadata.description) && (
                        <div className="px-4 sm:px-6 pb-2 space-y-2">
                            <img src={faucetMetadata.imageUrl || "/default.jpeg"} alt={faucetDetails?.name || 'Faucet'} className="w-full h-48 object-cover rounded-lg" />
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
                                    {faucetMetadata.description || "A faucet for distributing tokens"}
                                </p>
                            </div>
                        </div>
                    )}
                    <CardDescription className="text-xs sm:text-sm">
                        {address && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 font-bold mt-2">
                                <span>Connected Address:</span>
                                <span className="text-xs font-semibold font-mono break-all">{address}</span>
                            </div>
                        )}
                        {faucetType === 'droplist' && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 mt-1">
                                <span className="font-medium">Drop-list Status:</span>
                                {address ? (<span className={`text-xs ${userIsWhitelisted ? "text-green-600" : "text-red-600"}`}>{userIsWhitelisted ? "✓ Drop-listed" : "✗ Not Drop-listed"}</span>) : (<span className="text-xs text-gray-500">Connect wallet to check</span>)}
                            </div>
                        )}
                        {faucetType === 'custom' && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 mt-1">
                                <span className="font-medium">Custom Amount Status:</span>
                                {address ? (<span className={`text-xs ${hasCustomAmount ? "text-green-600" : "text-red-600"}`}>{hasCustomAmount ? "✓ Has allocation" : "✗ No allocation"}</span>) : (<span className="text-xs text-gray-500">Connect wallet to check</span>)}
                            </div>
                        )}
                    </CardDescription>
                </CardHeader>

                <div className="px-4 sm:px-6 pb-2">
                    <TokenBalance
                        tokenAddress={faucetDetails.token}
                        tokenSymbol={tokenSymbol}
                        tokenDecimals={tokenDecimals}
                        isNativeToken={faucetDetails.isEther}
                        networkChainId={selectedNetwork?.chainId}
                    />
                </div>
                
                <CardContent className="space-y-4 px-4 sm:px-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex flex-col p-3 sm:p-4 border rounded-lg">
                            <span className="text-xs sm:text-sm text-muted-foreground">{faucetType === 'custom' ? 'Your Claim Amount' : 'Drip Amount'}</span>
                            <span className="text-lg sm:text-2xl font-bold truncate">
                                {faucetType === 'custom' ? address ? hasCustomAmount ? `${formatUnits(userCustomClaimAmount, tokenDecimals)} ${tokenSymbol}` : "No allocation" : "Connect wallet" : faucetDetails.claimAmount ? `${formatUnits(faucetDetails.claimAmount, tokenDecimals)} ${tokenSymbol}` : `0 ${tokenSymbol}`}
                            </span>
                        </div>
                        <div className="flex flex-col p-3 sm:p-4 border rounded-lg">
                            <span className="text-xs sm:text-sm text-muted-foreground">Status</span>
                            <span className="text-lg sm:text-2xl font-bold truncate">
                                {faucetDetails.isClaimActive ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm">Start: {renderCountdown(Number(faucetDetails.startTime), "Start")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm">End: {renderCountdown(Number(faucetDetails.endTime), "End")}</span>
                      </div>
                    </div>

                    {shouldShowSecretCodeInput && (
                        <div className="space-y-2">
                            <Label htmlFor="secret-code" className="text-xs sm:text-sm">Drop Code</Label>
                            <Input
                                id="secret-code"
                                placeholder="Enter 6-character code (e.g., ABC123)"
                                value={secretCode}
                                onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                                className="text-xs sm:text-sm"
                                maxLength={6}
                            />
                            <p className="text-xs text-muted-foreground">Enter the 6-character alphanumeric code to drip tokens</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col md:flex-row gap-2 px-4 sm:px-6">
                    <Button
                        className="w-full h-8 sm:h-9 text-xs sm:text-sm"
                        onClick={handleFollowAll}
                        disabled={allAccountsVerified || dynamicTasks.length === 0}
                        variant={allAccountsVerified ? "secondary" : "default"}
                    >
                        {allAccountsVerified ? (<><Check className="h-4 w-4 mr-2" /> All Tasks Verified ✓</>) : (<><AlertCircle className="h-4 w-4 mr-2" /> Complete Tasks to Unlock Drops</>)}
                    </Button>
                    <Button
                        className="w-full h-8 sm:h-9 text-xs sm:text-sm"
                        variant="outline"
                        onClick={handleBackendClaim}
                        disabled={!address || !canClaim}
                    >
                        {!address ? "Connect Wallet to Drip" : hasClaimed ? "Already dripped" : "Drip Tokens"}
                    </Button>
                </CardFooter>
            </Card>

            {/* --- Dialogs for User View --- */}

            <Dialog open={showFollowDialog} onOpenChange={setShowFollowDialog}>
                <DialogContent className="w-11/12 max-w-lg max-h-[90vh] flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle className="text-lg sm:text-xl">Complete Required Tasks</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                            {dynamicTasks.length > 0 ? "Complete these tasks and provide your usernames to unlock token claims." : "No specific tasks required for this faucet."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
                        {dynamicTasks.length === 0 ? (
                            <div className="text-center py-8"><Check className="h-12 w-12 text-green-500 mx-auto mb-4" /><p className="text-lg font-semibold text-green-600">No Tasks Required!</p></div>
                        ) : (
                            dynamicTasks.map((task) => (
                                <div key={task.platform} className="p-4 border rounded-lg space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-lg">{getPlatformIcon(task.platform)}</span>
                                            <div>
                                                <p className="font-medium text-sm">{task.action} {task.handle}</p>
                                                <a href={task.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                    <ExternalLink className="h-3 w-3" /> {getActionText(task.platform)} on {task.platform}
                                                </a>
                                            </div>
                                        </div>
                                        <Badge variant={verificationStates[task.platform] ? "secondary" : "outline"} className="text-xs">
                                            {verificationStates[task.platform] ? <Check className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                                            {verificationStates[task.platform] ? "Verified" : "Pending"}
                                        </Badge>
                                    </div>
                                    {!verificationStates[task.platform] && (
                                        <div className="space-y-2">
                                            <Label htmlFor={`username-${task.platform}`} className="text-xs">Enter your {task.platform} username:</Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id={`username-${task.platform}`}
                                                    placeholder="username (without @)"
                                                    value={usernames[task.platform] || ''}
                                                    onChange={(e) => setUsernames(prev => ({ ...prev, [task.platform]: e.target.value }))}
                                                    className="text-xs pl-10"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <DialogFooter className="flex-shrink-0">
                        <Button
                            onClick={handleVerifyAllTasks}
                            className="text-xs sm:text-sm w-full"
                            disabled={!getAllUsernamesProvided() || allAccountsVerified || dynamicTasks.length === 0}
                        >
                            {allAccountsVerified ? "All Tasks Verified - Ready to Claim!" : "Verify All Tasks"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
                <DialogContent className="w-11/12 max-w-md">
                    <DialogHeader><DialogTitle className="text-lg sm:text-xl">Verifying Tasks</DialogTitle></DialogHeader>
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        {isVerifying ? (<><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div><p className="text-sm text-muted-foreground">Verifying your usernames...</p></>) : (
                            <><div className="rounded-full h-12 w-12 bg-green-500 flex items-center justify-center"><Check className="h-6 w-6 text-white" /></div><p className="text-sm text-green-600 font-medium">All Tasks Verified!</p></>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showClaimPopup} onOpenChange={setShowClaimPopup}>
                <DialogContent className="w-11/12 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg sm:text-xl">Drip Successful! 🎉</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">You have successfully dripped {claimedAmount} {tokenSymbol}.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col space-y-4 py-4">
                        <p className="text-xs sm:text-sm">Share your drop on X to help spread the word about FaucetDrops!</p>
                    </div>
                    <DialogFooter className="sm:justify-start flex flex-col sm:flex-row gap-2">
                        <Button type="button" variant="default" onClick={handleShareOnX} className="flex items-center gap-2 text-xs sm:text-sm">
                            <Share2 className="h-4 w-4" /> Share on 𝕏
                        </Button>
                        <Button variant="outline" onClick={() => setShowClaimPopup(false)} className="text-xs sm:text-sm">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default FaucetUserView;