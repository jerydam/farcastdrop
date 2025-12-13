"use client"

import type React from "react"
import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/hooks/use-wallet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Header } from "@/components/header"
import {
    getFaucetDetails,
    isWhitelisted,
    getAllAdmins,
    setWhitelistBatch,
    setCustomClaimAmountsBatch,
    resetAllClaims,
    fundFaucet,
    withdrawTokens,
    setClaimParameters,
    retrieveSecretCode,
    updateFaucetName,
    deleteFaucet,
    addAdmin,
    removeAdmin,
    getFaucetTransactionHistory,
} from "@/lib/faucet"
import { formatUnits, parseUnits, type BrowserProvider, JsonRpcProvider } from "ethers"
import { Checkbox } from "@/components/ui/checkbox"
import { claimViaBackend, claimNoCodeViaBackend, claimCustomViaBackend } from "@/lib/backend-service"
import { useNetwork } from "@/hooks/use-network"
import LoadingPage from "@/components/loading"
import FaucetAdminView from "@/components/faucetView/FaucetAdminView"
import FaucetUserView from "@/components/faucetView/FaucetUserView"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

// Faucet type definitions
type FaucetType = 'dropcode' | 'droplist' | 'custom'

interface SocialMediaLink {
    platform: string;
    url: string;
    handle: string;
    action: string;
}

// Default faucet metadata constants
const DEFAULT_FAUCET_IMAGE = "/default.jpeg";
const FACTORY_OWNER_ADDRESS = "0x9fBC2A0de6e5C5Fd96e8D11541608f5F328C0785"

// --- Helper Functions ---

const getDefaultFaucetDescription = (networkName: string, ownerAddress: string): string => {
    return `This is a faucet on ${networkName} by ${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}`
}

const getNativeTokenSymbol = (networkName: string): string => {
    switch (networkName) {
        case "Celo": return "CELO"
        case "Lisk": return "LISK"
        case "Arbitrum": case "Base": case "Ethereum": return "ETH"
        case "Polygon": return "MATIC"
        case "Optimism": return "ETH"
        default: return "ETH"
    }
}

const checkIsAdmin = async (provider: any, faucetAddress: string, userAddress: string, type: FaucetType): Promise<boolean> => {
    if (userAddress.toLowerCase() === FACTORY_OWNER_ADDRESS.toLowerCase()) {
        return true
    }
    try {
        const { Contract } = await import("ethers")
        let abi: any[]
        if (type === 'dropcode') { const { FAUCET_ABI_DROPCODE } = await import("@/lib/abis"); abi = FAUCET_ABI_DROPCODE } 
        else if (type === 'droplist') { const { FAUCET_ABI_DROPLIST } = await import("@/lib/abis"); abi = FAUCET_ABI_DROPLIST } 
        else if (type === 'custom') { const { FAUCET_ABI_CUSTOM } = await import("@/lib/abis"); abi = FAUCET_ABI_CUSTOM } 
        else { return false }
        const contract = new Contract(faucetAddress, abi, provider)
        const isContractAdmin = await contract.isAdmin(userAddress)
        return isContractAdmin
    } catch (error) {
        console.warn("Error checking admin status:", error)
        return false
    }
}

const detectFaucetType = async (provider: any, address: string): Promise<FaucetType> => {
    try {
        const { Contract } = await import("ethers")
        const basicABI = [{ "inputs": [], "name": "faucetType", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }]
        const contract = new Contract(address, basicABI, provider)
        const contractType = (await contract.faucetType()).toLowerCase()
        return (contractType === 'dropcode' || contractType === 'droplist' || contractType === 'custom') ? contractType : 'dropcode'
    } catch (error) {
        console.error("Error getting faucet type from contract, defaulting:", error)
        return 'dropcode' 
    }
}

const getUserCustomClaimAmount = async (provider: any, userAddress: string, faucetAddress: string, tokenDecimals: number): Promise<{ amount: bigint, hasCustom: boolean }> => {
    try {
        const { FAUCET_ABI_CUSTOM } = await import("@/lib/abis")
        const { Contract } = await import("ethers")
        const faucetContract = new Contract(faucetAddress, FAUCET_ABI_CUSTOM, provider)
        
        // Simulate check
        const isOwnerOrAdmin = await checkIsAdmin(provider, faucetAddress, userAddress, 'custom');
        if (isOwnerOrAdmin) {
            return { amount: BigInt(0), hasCustom: false } 
        }
        
        const hasCustom = await faucetContract.hasCustomClaimAmount(userAddress)
        if (hasCustom) {
            const customAmount = await faucetContract.getCustomClaimAmount(userAddress)
            return { amount: customAmount, hasCustom: true }
        }
        return { amount: BigInt(0), hasCustom: false }
    } catch {
        return { amount: BigInt(0), hasCustom: false }
    }
}

const loadSocialMediaLinks = async (faucetAddress: string): Promise<SocialMediaLink[]> => {
    try {
        const apiUrl = `https://fauctdrop-backend.onrender.com/faucet-tasks/${faucetAddress}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            if (response.status === 404) {
                return [];
            }
            throw new Error(`Failed to fetch tasks: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!Array.isArray(result.tasks)) {
             return [];
        }

        return result.tasks.map((task: any) => ({
            platform: task.platform || 'link',
            url: task.url,
            handle: task.handle,
            action: task.action || 'check'
        })) || [];

    } catch (error) {
        console.error('Error fetching dynamic tasks:', error);
        return [];
    }
}

const loadFaucetMetadata = async (faucetAddress: string): Promise<{description: string, imageUrl: string}> => {
  try {
    const response = await fetch(`https://fauctdrop-backend.onrender.com/faucet-metadata/${faucetAddress}`);
    if (!response.ok) {
      if (response.status === 404) {
        return {description: '', imageUrl: DEFAULT_FAUCET_IMAGE};
      }
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    const result = await response.json();
    return {
      description: result.description || '',
      imageUrl: result.imageUrl || DEFAULT_FAUCET_IMAGE
    };
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return {description: '', imageUrl: DEFAULT_FAUCET_IMAGE};
  }
};

const FIXED_TWEET_PREFIX = "I just dripped {amount} {token} from @FaucetDrops on {network}.";
const loadCustomXPostTemplate = async (faucetAddress: string): Promise<string> => {
    return `Verify Drop 💧: {explorer}`
}

const saveAdminPopupPreference = async (userAddr: string, faucetAddr: string, dontShow: boolean): Promise<boolean> => {
    try {
        const response = await fetch("https://fauctdrop-backend.onrender.com/admin-popup-preference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userAddress: userAddr, faucetAddress: faucetAddr, dontShowAgain: dontShow }),
        })
        if (!response.ok) throw new Error(`Failed to save preference`)
        const result = await response.json()
        return result.success
    } catch (error) {
        console.error("Error saving admin popup preference:", error)
        return false
    }
}

const getAdminPopupPreference = async (userAddr: string, faucetAddr: string): Promise<boolean> => {
    try {
        const response = await fetch(
            `https://fauctdrop-backend.onrender.com/admin-popup-preference?userAddress=${encodeURIComponent(userAddr)}&faucetAddress=${encodeURIComponent(faucetAddr)}`
        )
        if (!response.ok) return false
        const result = await response.json()
        return result.dontShowAgain || false
    } catch (error) {
        return false
    }
}

// --- Main Component ---
export default function FaucetDetails() {
    const { address: faucetAddress } = useParams<{ address: string }>()
    const searchParams = useSearchParams()
    const networkId = searchParams.get("networkId")
    const { toast } = useToast()
    const router = useRouter()
    const { address, chainId, isConnected, provider } = useWallet()
    const { networks, setNetwork } = useNetwork()
    
    // --- Main State ---
    const [faucetDetails, setFaucetDetails] = useState<any>(null)
    const [faucetType, setFaucetType] = useState<FaucetType | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedNetwork, setSelectedNetwork] = useState<any>(null)
    
    // --- User-Specific State ---
    const [userIsAdmin, setUserIsAdmin] = useState(false)
    const [hasClaimed, setHasClaimed] = useState(false)
    const [userIsWhitelisted, setUserIsWhitelisted] = useState(false)
    const [userCustomClaimAmount, setUserCustomClaimAmount] = useState<bigint>(BigInt(0))
    const [hasCustomAmount, setHasCustomAmount] = useState(false)
    const [secretCode, setSecretCode] = useState("")
    const [usernames, setUsernames] = useState<Record<string, string>>({})
    const [verificationStates, setVerificationStates] = useState<Record<string, boolean>>({})
    const [isVerifying, setIsVerifying] = useState(false)
    const [showFollowDialog, setShowFollowDialog] = useState(false)
    const [showVerificationDialog, setShowVerificationDialog] = useState(false)
    const [showClaimPopup, setShowClaimPopup] = useState(false)
    const [txHash, setTxHash] = useState<string | null>(null)
    
    // --- Verification Logic State ---
    const [hasAttemptedVerification, setHasAttemptedVerification] = useState(false)

    // --- Admin-Specific State (Passed down) ---
    const [adminList, setAdminList] = useState<string[]>([])
    const [backendMode, setBackendMode] = useState(true)
    const [tokenSymbol, setTokenSymbol] = useState("ETH")
    const [tokenDecimals, setTokenDecimals] = useState(18)
    const [faucetMetadata, setFaucetMetadata] = useState<{description?: string, imageUrl?: string}>({})
    const [customXPostTemplate, setCustomXPostTemplate] = useState("")
    const [dynamicTasks, setDynamicTasks] = useState<SocialMediaLink[]>([])
    const [transactions, setTransactions] = useState<any[]>([])
    const [showAdminPopup, setShowAdminPopup] = useState(false)
    const [dontShowAdminPopupAgain, setDontShowAdminPopupAgain] = useState(false)
    const [newSocialLinks, setNewSocialLinks] = useState<SocialMediaLink[]>([])
    const [claimAmount, setClaimAmount] = useState("0")
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")

    // --- Derived State ---
    const isOwner = address && faucetDetails?.owner && address.toLowerCase() === faucetDetails.owner.toLowerCase()
    const isBackendAddress = address && address.toLowerCase() === FACTORY_OWNER_ADDRESS.toLowerCase()
    const canAccessAdminControls = isOwner || userIsAdmin || isBackendAddress
    
    const getTaskKey = (task: SocialMediaLink) => task.platform;
    const isSecretCodeValid = secretCode.length === 6 && /^[A-Z0-9]{6}$/.test(secretCode)
    const allAccountsVerified = dynamicTasks.length === 0 ? true : dynamicTasks.every(task => verificationStates[getTaskKey(task)])
    
    const checkNetwork = useCallback((skipToast = false): boolean => {
      if (!chainId) {
        if (!skipToast) toast({ title: "Network not detected", description: "Please ensure your wallet is connected.", variant: "destructive" });
        return false
      }
      if (networkId && Number(networkId) !== chainId) {
        const targetNetwork = networks.find((n) => n.chainId === Number(networkId))
        if (targetNetwork) {
          if (!skipToast) toast({ title: "Wrong Network", description: "Switch to the network to perform operation", variant: "destructive", action: (<Button onClick={() => setNetwork(targetNetwork)} variant="outline">Switch to {targetNetwork.name}</Button>), });
          return false
        }
      }
      return true
    }, [chainId, networkId, networks, setNetwork, toast])
    
    const handleGoBack = useCallback((): void => {
      if (window.history.length > 1) {
        router.back()
      } else {
        router.push("/")
      }
    }, [router])

    // --- Core Data Loader ---
    const loadFaucetDetails = useCallback(async (): Promise<void> => {
      if (!faucetAddress || !networkId) { setLoading(false); return }
      try {
        setLoading(true)
        const targetNetworkId = Number(networkId)
        const targetNetwork = networks.find((n) => n.chainId === targetNetworkId)
        if (!targetNetwork) { router.push("/"); return }
        
        setSelectedNetwork(targetNetwork)
        const detailsProvider = new JsonRpcProvider(targetNetwork.rpcUrl)
        
        const detectedType = await detectFaucetType(detailsProvider, faucetAddress)
        setFaucetType(detectedType)
        
        const details = await getFaucetDetails(detailsProvider, faucetAddress, detectedType)
        if (!details || details.error) { throw new Error(details?.error || "Failed to fetch faucet details") }
        setFaucetDetails(details)
        setTokenSymbol(details.tokenSymbol || getNativeTokenSymbol(targetNetwork.name))
        setTokenDecimals(details.tokenDecimals || 18)
        setBackendMode(details.backendMode || false)
        
        setDynamicTasks(await loadSocialMediaLinks(faucetAddress))
        setCustomXPostTemplate(await loadCustomXPostTemplate(faucetAddress))
        
        const metadata = await loadFaucetMetadata(faucetAddress);
        setFaucetMetadata({ 
            description: metadata.description || getDefaultFaucetDescription(targetNetwork.name, details.owner),
            imageUrl: metadata.imageUrl
        })

        if (address) {
          setHasClaimed(details.hasClaimed || false)
          if (detectedType === 'droplist') {
            const whitelisted = await isWhitelisted(detailsProvider, faucetAddress, address, detectedType)
            setUserIsWhitelisted(whitelisted)
          }
          if (detectedType === 'custom') {
            const customClaimInfo = await getUserCustomClaimAmount(detailsProvider, address, faucetAddress, details.tokenDecimals || 18)
            setUserCustomClaimAmount(customClaimInfo.amount)
            setHasCustomAmount(customClaimInfo.hasCustom)
          }
          const adminStatus = await checkIsAdmin(detailsProvider, faucetAddress, address, detectedType)
          setUserIsAdmin(adminStatus)
          
          if (adminStatus || isOwner) {
              const dontShow = await getAdminPopupPreference(address, faucetAddress)
              if (!dontShow) setShowAdminPopup(true)
          }
        }
        
        const admins = await getAllAdmins(detailsProvider, faucetAddress, detectedType)
        const allAdmins = [...admins]
        if (details.owner && !allAdmins.some(a => a.toLowerCase() === details.owner.toLowerCase())) { allAdmins.unshift(details.owner) }
        if (!allAdmins.some(a => a.toLowerCase() === FACTORY_OWNER_ADDRESS.toLowerCase())) { allAdmins.push(FACTORY_OWNER_ADDRESS) }
        setAdminList(allAdmins)

        if (details.claimAmount) {
            setClaimAmount(formatUnits(details.claimAmount, details.tokenDecimals || 18))
        }
        if (details.startTime) {
            const date = new Date(Number(details.startTime) * 1000)
            setStartTime(date.toISOString().slice(0, 16))
        }
        if (details.endTime) {
            const date = new Date(Number(details.endTime) * 1000)
            setEndTime(date.toISOString().slice(0, 16))
        }
        
      } catch (error: any) {
        toast({ title: "Failed to load faucet details", description: error.message || "Unknown error occurred", variant: "destructive", })
      } finally {
        setLoading(false)
      }
    }, [
        faucetAddress, networkId, networks, router, toast, address, isOwner, 
        setClaimAmount, setStartTime, setEndTime, setTokenSymbol, setTokenDecimals, setBackendMode,
        setDynamicTasks, setCustomXPostTemplate, setFaucetMetadata, setUserIsAdmin, setHasClaimed,
        setUserIsWhitelisted, setUserCustomClaimAmount, setHasCustomAmount, setAdminList, setShowAdminPopup
    ])

    useEffect(() => {
      if (faucetAddress && networkId) loadFaucetDetails()
    }, [faucetAddress, networkId, loadFaucetDetails])

    const handleFollowAll = (): void => {
      if (dynamicTasks.length === 0) {
        toast({ title: "No Tasks", description: "This faucet does not require social media verification.", variant: "default" })
        return
      }
      setShowFollowDialog(true)
    }

    // --- UPDATED VERIFICATION LOGIC ---
    const handleVerifyAllTasks = async (): Promise<void> => {
        const allUsernamesProvided = dynamicTasks.every(task => usernames[getTaskKey(task)] && usernames[getTaskKey(task)].trim().length > 0)
        if (!allUsernamesProvided) {
          toast({ title: "Missing Information", description: "Please enter usernames for all required tasks.", variant: "destructive", })
          return
        }

        setIsVerifying(true)
        setShowVerificationDialog(true)

        // Simulate verification process (3 seconds delay)
        setTimeout(() => {
          // Check if this is the first attempt
          if (!hasAttemptedVerification) {
              // FIRST ATTEMPT: FAIL
              setIsVerifying(false)
              setShowVerificationDialog(false)
              setHasAttemptedVerification(true) // Mark as attempted so next time it succeeds
              
              toast({
                  title: "Verification Failed",
                  description: "Can't verify. Please complete the tasks and try again.",
                  variant: "destructive",
              })
          } else {
              // SECOND+ ATTEMPT: SUCCEED
              const newVerificationStates: Record<string, boolean> = {}
              dynamicTasks.forEach(task => { newVerificationStates[getTaskKey(task)] = true })
              setVerificationStates(newVerificationStates)
              setIsVerifying(false)
              toast({ title: "All Tasks Verified", description: "All required tasks have been verified successfully!", })
              setTimeout(() => {
                setShowVerificationDialog(false)
                setShowFollowDialog(false)
              }, 2000)
          }
        }, 3000)
    }
    
    const generateXPostContent = (amount: string): string => {
      let content = `${FIXED_TWEET_PREFIX} ${customXPostTemplate}`
      content = content.replace(/\{amount\}/g, amount)
      content = content.replace(/\{token\}/g, tokenSymbol)
      content = content.replace(/\{network\}/g, selectedNetwork?.name || "the network")
      content = content.replace(/\{faucet\}/g, faucetDetails?.name || "this faucet")
      content = content.replace(/\{explorer\}/g, txHash ? `${selectedNetwork?.blockExplorerUrls || "https://explorer.unknown"}/tx/${txHash}` : "Transaction not available")
      return content
    }

    async function handleBackendClaim(): Promise<void> {
      if (!isConnected || !address || !faucetDetails) { toast({ title: "Wallet not connected", description: "Please connect your wallet.", variant: "destructive", }); return; }
      if (!checkNetwork()) return;

      if (faucetType === 'dropcode' && backendMode && !isSecretCodeValid) { toast({ title: "Invalid Drop code", description: "Please enter a valid 6-character alphanumeric Drop code", variant: "destructive", }); return; }
      if (faucetType === 'droplist' && !userIsWhitelisted) { toast({ title: "Not Drop-listed", description: "You are not Drop-listed to claim.", variant: "destructive", }); return; }
      if (faucetType === 'custom' && !hasCustomAmount) { toast({ title: "No Custom Allocation", description: "You don't have a custom amount allocated.", variant: "destructive", }); return; }
      if (!allAccountsVerified) { toast({ title: "Verification Required", description: "Please complete and verify all required tasks before claiming", variant: "destructive", }); return; }

      try {
        setIsVerifying(true);
        let result;
        const providerForClaim = provider as BrowserProvider;
        
        if (faucetType === 'custom') {
          result = await claimCustomViaBackend(address, faucetAddress, providerForClaim)
        } else if (faucetType === 'dropcode' && backendMode) {
          result = await claimViaBackend(address, faucetAddress, providerForClaim, secretCode)
        } else {
          result = await claimNoCodeViaBackend(address, faucetAddress, providerForClaim);
        }

        setTxHash(result.txHash);

        const claimedAmount = faucetType === 'custom' && hasCustomAmount
          ? formatUnits(userCustomClaimAmount, tokenDecimals)
          : faucetDetails.claimAmount
          ? formatUnits(faucetDetails.claimAmount, tokenDecimals)
          : "tokens";

        toast({ title: "Tokens dripped successfully", description: `You have dripped ${claimedAmount} ${tokenSymbol}.`, });
        setShowClaimPopup(true);
        setSecretCode("");
        await loadFaucetDetails();
        
      } catch (error: any) {
        console.error("Error dropping tokens:", error);
        toast({ title: "Failed to drop tokens", description: error.message || "Unknown error occurred", variant: "destructive", });
      } finally {
        setIsVerifying(false);
      }
    }

    const handleCloseAdminPopup = async (): Promise<void> => {
      if (dontShowAdminPopupAgain && faucetAddress && address) {
        const saved = await saveAdminPopupPreference(address, faucetAddress, true)
        if (saved) {
          toast({ title: "Preference Saved", description: "Your popup preference has been saved." })
        }
      }
      setShowAdminPopup(false)
      setDontShowAdminPopupAgain(false)
    }

    if (loading) {
      return <LoadingPage />
    }

    if (!faucetDetails) {
      return (
          <Card className="w-full mx-auto max-w-xl">
            <CardContent className="py-10 text-center">
              <p className="text-sm sm:text-base">Faucet not found or error loading details</p>
              <Button className="mt-4" onClick={() => router.push("/")}>Return to Home</Button>
            </CardContent>
          </Card>
      )
    }

    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col gap-6 sm:gap-8 max-w-3xl sm:max-w-4xl mx-auto">
            <Header pageTitle="Faucet Details" />

            {canAccessAdminControls ? (
              <FaucetAdminView 
                  faucetAddress={faucetAddress}
                  faucetDetails={faucetDetails}
                  faucetType={faucetType}
                  tokenSymbol={tokenSymbol}
                  tokenDecimals={tokenDecimals}
                  selectedNetwork={selectedNetwork}
                  adminList={adminList}
                  isOwner={isOwner}
                  backendMode={backendMode}
                  canAccessAdminControls={canAccessAdminControls}
                  loadFaucetDetails={loadFaucetDetails}
                  checkNetwork={checkNetwork}
                  dynamicTasks={dynamicTasks}
                  newSocialLinks={newSocialLinks}
                  setNewSocialLinks={setNewSocialLinks}
                  customXPostTemplate={customXPostTemplate}
                  setCustomXPostTemplate={setCustomXPostTemplate}
                  setTransactions={setTransactions}
                  transactions={transactions}
                  address={address}
                  chainId={chainId}
                  provider={provider}
                  handleGoBack={handleGoBack}
                  router={router}
                  // --- PASSED PROP ---
                  faucetMetadata={faucetMetadata}
              />
            ) : (
              <FaucetUserView 
                faucetAddress={faucetAddress}
                faucetDetails={faucetDetails}
                faucetType={faucetType}
                tokenSymbol={tokenSymbol}
                tokenDecimals={tokenDecimals}
                selectedNetwork={selectedNetwork}
                address={address}
                isConnected={isConnected}
                hasClaimed={hasClaimed}
                userIsWhitelisted={userIsWhitelisted}
                hasCustomAmount={hasCustomAmount}
                userCustomClaimAmount={userCustomClaimAmount}
                dynamicTasks={dynamicTasks}
                allAccountsVerified={allAccountsVerified}
                secretCode={secretCode}
                setSecretCode={setSecretCode}
                usernames={usernames}
                setUsernames={setUsernames}
                verificationStates={verificationStates}
                setVerificationStates={setVerificationStates}
                isVerifying={isVerifying}
                faucetMetadata={faucetMetadata}
                customXPostTemplate={customXPostTemplate}
                handleBackendClaim={handleBackendClaim}
                handleFollowAll={handleFollowAll}
                generateXPostContent={generateXPostContent}
                txHash={txHash}
                showFollowDialog={showFollowDialog}
                setShowFollowDialog={setShowFollowDialog}
                showVerificationDialog={showVerificationDialog}
                setShowVerificationDialog={setShowVerificationDialog}
                showClaimPopup={showClaimPopup}
                setShowClaimPopup={setShowClaimPopup}
                handleVerifyAllTasks={handleVerifyAllTasks}
                handleGoBack={handleGoBack}
              />
            )}
          </div>
        </div>
        
        <Dialog open={showAdminPopup} onOpenChange={setShowAdminPopup}>
          <DialogContent className="w-11/12 max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Admin Controls Guide</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Learn how to manage your {faucetType || 'unknown'} faucet as an admin.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="text-sm sm:text-base font-semibold">Admin Privileges</h3>
                <div className="text-xs sm:text-sm text-muted-foreground space-y-2">
                  <p>As an admin, you can perform the following actions on this {faucetType || 'unknown'} faucet:</p>
                </div>
                <ul className="list-disc pl-5 text-xs sm:text-sm text-muted-foreground">
                  <li><strong>Fund/Withdraw:</strong> Manage faucet balance.</li>
                  <li><strong>Parameters:</strong> Set claim amount, timing, and social media tasks.</li>
                  {faucetType === 'droplist' && (<li><strong>Drop-list:</strong> Add or remove addresses.</li>)}
                  {faucetType === 'custom' && (<li><strong>Custom:</strong> Upload CSV for custom allocations.</li>)}
                  <li><strong>Admin Power:</strong> Manage admins and reset claims.</li>
                  <li><strong>Activity Log:</strong> View transaction history.</li>
                </ul>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dont-show-again"
                  checked={dontShowAdminPopupAgain}
                  onCheckedChange={(checked) => setDontShowAdminPopupAgain(checked === true)}
                />
                <Label htmlFor="dont-show-again" className="text-xs sm:text-sm">
                  Don't show this again for this faucet
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCloseAdminPopup} className="text-xs sm:text-sm w-full">Got It</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    )
  }