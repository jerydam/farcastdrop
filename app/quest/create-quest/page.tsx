"use client"
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
    Plus,
    Trash2,
    Save,
    Settings,
    Loader2,
    ListPlus,
    Zap,
    Upload,
    Link,
    Wallet,
    Coins,
    Share2,
    Trophy,
    Check,
    AlertTriangle,
    ArrowRight,
    ArrowLeft,
    Eye,
    Image as ImageIcon,
    Lock,
    Unlock,
} from "lucide-react"
// --- LIVE EXTERNAL DEPENDENCIES ---
import { useWallet } from "@/hooks/use-wallet"
import {Header} from "@/components/header"; // Assuming default export, check your header file
// If Header is a named export (export const Header):
// import { Header } from "@/components/header"; 

// --- Ethers v6 Imports ---
import { Contract, BrowserProvider, ZeroAddress, Interface } from 'ethers';
const isAddress = (addr: string) => addr.startsWith('0x') && addr.length === 42;

// --- ⚙️ IMPORTED FAUCET/NETWORK UTILITIES (from lib/faucet) ---
import { 
    checkFaucetNameExists, 
    createCustomFaucet, // Keeping createCustomFaucet for now, assuming it's exported
    type Network, 
    type NameValidationResult, 
    type FactoryType, 
    
} from "@/lib/faucet"; 
// ----------------------------------------------------------

// --- LOCAL NETWORK & TOKEN CONFIGURATION ---
const FAUCET_TYPE_CUSTOM = 'custom' as const;

export const networks: Network[] = [
    {
        name: "Celo", symbol: "CELO", chainId: BigInt(42220), rpcUrl: "https://forno.celo.org", blockExplorer: "https://celoscan.io", color: "#35D07F", logoUrl: "/celo.png", iconUrl: "/celo.png",
        factoryAddresses: ["0x17cFed7fEce35a9A71D60Fbb5CA52237103A21FB", "0x8cA5975Ded3B2f93E188c05dD6eb16d89b14aeA5"], // Simplified array
        factories: { custom: "0x8cA5975Ded3B2f93E188c05dD6eb16d89b14aeA5" }, tokenAddress: "0x471EcE3750Da237f93B8E339c536989b8978a438", nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18, }, isTestnet: false,
    },
    {
        name: "Lisk", symbol: "LSK", chainId: BigInt(1135), rpcUrl: "https://rpc.api.lisk.com", blockExplorer: "https://blockscout.lisk.com", explorerUrl: "https://blockscout.lisk.com", color: "#0D4477", logoUrl: "/lsk.png", iconUrl: "/lsk.png",
        factoryAddresses: ["0x21E855A5f0E6cF8d0CfE8780eb18e818950dafb7"],
        factories: { custom: "0x21E855A5f0E6cF8d0CfE8780eb18e818950dafb7" }, tokenAddress: ZeroAddress, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18, }, isTestnet: false,
    },
    {
        name: "Arbitrum", symbol: "ARB", chainId: BigInt(42161), rpcUrl: "https://arb1.arbitrum.io/rpc", blockExplorer: "https://arbiscan.io", explorerUrl: "https://arbiscan.io", color: "#28A0F0", logoUrl: "/arb.jpeg", iconUrl: "/arb.jpeg",
        factoryAddresses: ["0x9D6f441b31FBa22700bb3217229eb89b13FB49de"],
        factories: { custom: "0x9D6f441b31FBa22700bb3217229eb89b13FB49de" }, tokenAddress: ZeroAddress, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18, }, isTestnet: false,
    },
    {
        name: "Base", symbol: "BASE", chainId: BigInt(8453), rpcUrl: "https://base.publicnode.com", blockExplorer: "https://basescan.org", explorerUrl: "https://basescan.org", color: "#0052FF", logoUrl: "/base.png", iconUrl: "/base.png",
        factoryAddresses: ["0x587b840140321DD8002111282748acAdaa8fA206"],
        factories: { custom: "0x587b840140321DD8002111282748acAdaa8fA206" }, tokenAddress: ZeroAddress, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18, }, isTestnet: false,
    }
];

// Local utility functions (adapted from use-network)
const getNetworkByChainId = (chainId: number | null): Network | null => {
    if (!chainId) return null;
    const bigIntChainId = BigInt(chainId);
    return networks.find(n => n.chainId === bigIntChainId) || null;
}
const getFactoryAddress = (factoryType: 'custom', targetNetwork: Network | null): string | null => {
    if (!targetNetwork) return null;
    return targetNetwork.factories[factoryType] || null;
}
// --------------------------------------------------

// --- FAUCET.TS LOGIC & INTERFACES (CRITICAL FOR UI) ---
const FACTORY_TYPE_CUSTOM = 'custom' as const;
// NOTE: NameValidationResult is imported above
interface FaucetDetail {
    faucetAddress: string;
    name: string;
    owner: string;
    token: string;
}

const zeroAddress = ZeroAddress;
const getTodayDateString = () => new Date().toISOString().split('T')[0];
const getFutureDateString = (days: number) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return futureDate.toISOString().split('T')[0];
}

interface TokenConfiguration {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    isNative?: boolean;
    logoUrl?: string;
    description?: string;
}

const ALL_TOKENS_BY_CHAIN: Record<number, TokenConfiguration[]> = {
    // Celo Mainnet (42220)
    42220: [
        {
            address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
            name: "Celo",
            symbol: "CELO",
            decimals: 18,
            isNative: true,
            logoUrl: "/celo.jpeg", // ✅ Local path
            description: "Native Celo token for governance and staking",
        },
        {
            address: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71",
            name: "Celo Nigerian Naira",
            symbol: "cNGN",
            decimals: 18,
            logoUrl: "/cngn.png", // ✅ Local path
            description: "Naira-pegged stablecoin on Celo",
        },
        {
            address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA",
            name: "Celo Colombian Peso",
            symbol: "cCOP",
            decimals: 18,
            logoUrl: "/ccop.png",
            description: "colombian peso-pegged stablecoin on Celo",

        },
        {
            address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
            name: "Celo Dollar",
            symbol: "cUSD",
            decimals: 18,
            logoUrl: "/cusd.png", // ✅ Local path
            description: "USD-pegged stablecoin on Celo",
        },
        {
            address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
            name: "Tether",
            symbol: "USDT",
            decimals: 6,
            logoUrl: "/usdt.jpg", // ✅ Local path
            description: "Tether USD stablecoin",
        },
        {
            address: "0x639A647fbe20b6c8ac19E48E2de44ea792c62c5C",
            name: "Celo Brazilian Real",
            symbol: "cREAL",
            decimals: 18,
            logoUrl: "/creal.jpg", // ✅ Local path
            description: "Brazilian Real-pegged stablecoin on Celo",
        },
        {
            address: "0x32A9FE697a32135BFd313a6Ac28792DaE4D9979d",
            name: "Celo Kenyan Shilling",
            symbol: "cKES",
            decimals: 18,
            logoUrl: "/ckes.jpg", // ✅ Local path
            description: "Kenyan Shilling-pegged stablecoin on Celo",
        },
        {
            address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
            name: "USD Coin",
            symbol: "USDC",
            decimals: 6,
            logoUrl: "/usdc.jpg", // ✅ Local path
            description: "USD Coin stablecoin",
        },
        {
            address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
            name: "Celo Euro",
            symbol: "cEUR",
            decimals: 18,
            logoUrl: "/ceur.png", // ✅ Local path
            description: "Euro-pegged stablecoin on Celo",
        },
        {
            address: "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3",
            name: "Glo Dollar",
            symbol: "USDGLO",
            decimals: 18,
            logoUrl: "/glo.jpg", // ✅ Local path
            description: "Philanthropic dollar that funds global poverty relief",
        },
        {
            address: "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a",
            name: "GoodDollar",
            symbol: "G$",
            decimals: 18,
            logoUrl: "/gd.jpg", // ✅ Local path
            description: "Universal basic income token",
        },
    ],

    // Lisk Mainnet (1135)
    1135: [
        {
            address: zeroAddress,
            name: "Ethereum",
            symbol: "ETH",
            decimals: 18,
            isNative: true,
            logoUrl: "/ether.jpeg", // ✅ Local path
            description: "Native Ethereum for transaction fees",
        },
        {
            address: "0xac485391EB2d7D88253a7F1eF18C37f4242D1A24",
            name: "Lisk",
            symbol: "LSK",
            decimals: 18,
            logoUrl: "/lsk.png", // ✅ Local path
            description: "Lisk native token",
        },
        {
            address: "0x05D032ac25d322df992303dCa074EE7392C117b9",
            name: "Tether USD",
            symbol: "USDT",
            decimals: 6,
            logoUrl: "/usdt.jpg", // ✅ Local path
            description: "Tether USD stablecoin",
        },
        {
            address: "0xF242275d3a6527d877f2c927a82D9b057609cc71",
            name: "Bridged USDC",
            symbol: "USDC.e",
            decimals: 6,
            logoUrl: "/usdc.jpg", // ✅ Local path
            description: "Bridged USD Coin from Ethereum",
        },
    ],

    // Arbitrum One (42161)
    42161: [
        {
            address: zeroAddress,
            name: "Ethereum",
            symbol: "ETH",
            decimals: 18,
            isNative: true,
            logoUrl: "/ether.jpeg", // ✅ Local path
            description: "Native Ethereum for transaction fees",
        },
        {
            address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            name: "USD Coin",
            symbol: "USDC",
            decimals: 6,
            logoUrl: "/usdc.jpg", // ✅ Local path
            description: "Native USD Coin on Arbitrum",
        },
        {
            address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
            name: "Tether USD",
            symbol: "USDT",
            decimals: 6,
            logoUrl: "/usdt.jpg", // ✅ Local path
            description: "Tether USD stablecoin",
        },
        {
            address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
            name: "Arbitrum",
            symbol: "ARB",
            decimals: 18,
            logoUrl: "/arb.jpeg", // ✅ Local path
            description: "Arbitrum governance token",
        },
    ],

    // Base Mainnet (8453)
    8453: [
        {
            address: zeroAddress,
            name: "Ethereum",
            symbol: "ETH",
            decimals: 18,
            isNative: true,
            logoUrl: "/ether.jpeg", // ✅ Local path
            description: "Native Ethereum for transaction fees",
        },
        {
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            name: "USD Coin",
            symbol: "USDC",
            decimals: 6,
            logoUrl: "/usdc.jpg", // ✅ Local path
            description: "Native USD Coin on Base",
        },
        {
            address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
            name: "Bridged Tether USD",
            symbol: "USDT",
            decimals: 6,
            logoUrl: "/usdt.jpg", // ✅ Local path
            description: "Bridged Tether USD from Ethereum",
        },
        {
            address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
            name: "Degen",
            symbol: "DEGEN",
            decimals: 18,
            logoUrl: "/degen.png", // ✅ Local path
            description: "Degen community token",
        },
    ],
}
export type TaskStage = 'Beginner' | 'Intermediate' | 'Advance' | 'Legend' | 'Ultimate';
export const TASK_STAGES: TaskStage[] = ['Beginner', 'Intermediate', 'Advance', 'Legend', 'Ultimate'];
const MAX_PASS_POINT_RATIO = 0.7;

const STAGE_TASK_REQUIREMENTS: Record<TaskStage, { min: number; max: number }> = {
    Beginner: { min: 5, max: 10 },
    Intermediate: { min: 3, max: 8 },
    Advance: { min: 2, max: 6 },
    Legend: { min: 2, max: 5 },
    Ultimate: { min: 1, max: 3 },
};

type VerificationType = 'auto_social' | 'auto_tx' | 'manual_link' | 'manual_upload' | 'none';
export type SocialPlatform = 'Twitter' | 'Facebook' | 'Tiktok' | 'Youtube' | 'Discord' | 'Thread' | 'Linkedin' | 'Farcaster' | 'Instagram' | 'Website';
const SOCIAL_PLATFORMS: SocialPlatform[] = ['Twitter', 'Facebook', 'Tiktok', 'Youtube', 'Discord', 'Thread', 'Linkedin', 'Farcaster', 'Instagram', 'Website'];
const SOCIAL_ACTIONS = ['follow', 'retweet', 'like', 'join', 'subscribe', 'visit'];
const TRADING_ACTIONS = ['swap', 'stake', 'deposit', 'lend'];

interface QuestTask {
    id: string
    title: string
    description: string
    points: number
    required: boolean
    category: 'social' | 'trading' | 'swap' | 'referral' | 'content' | 'general'
    url: string
    action: string
    verificationType: VerificationType
    targetPlatform?: string
    targetHandle?: string
    targetContractAddress?: string
    targetChainId?: string
    stage: TaskStage
    minReferrals?: number
}

// NOTE: This interface MUST be manually kept in sync with the FastAPI Pydantic model
interface StagePassRequirements {
    Beginner: number;
    Intermediate: number;
    Advance: number;
    Legend: number;
    Ultimate: number;
}

interface Quest {
    id: string
    creatorAddress: string
    title: string
    description: string
    isActive: boolean
    rewardPool: string
    startDate: string
    endDate: string
    tasks: QuestTask[]
    faucetAddress?: string;
    rewardTokenType: 'native' | 'erc20';
    tokenAddress: string;
    stagePassRequirements: StagePassRequirements; // UPDATED
    imageUrl: string;
}

const initialStagePassRequirements: StagePassRequirements = {
    Beginner: 0, Intermediate: 0, Advance: 0, Legend: 0, Ultimate: 0,
}

const initialNewQuest: Omit<Quest, 'id' | 'creatorAddress' | 'stagePassRequirements'> = {
    title: "New Community Campaign",
    description: "Join our ecosystem and earn rewards.",
    isActive: true,
    rewardPool: "TBD",
    startDate: getTodayDateString(),
    endDate: getFutureDateString(7),
    tasks: [],
    faucetAddress: undefined,
    rewardTokenType: 'native',
    tokenAddress: ZeroAddress,
    imageUrl: "https://placehold.co/1024x1024/3b82f6/ffffff?text=Quest+Logo", // UPDATED default image size
}

const initialNewTaskForm: Partial<QuestTask> = {
    title: "",
    description: "",
    points: 100,
    required: true,
    category: "social",
    url: "",
    action: "follow",
    verificationType: "manual_link",
    targetPlatform: "Twitter",
    stage: 'Beginner',
    minReferrals: undefined,
}

const FACTORY_ABI_CUSTOM: any[] = [
    // Assuming this ABI segment is defined in faucet.ts now
    // Only keeping this definition if it's strictly needed outside of imported functions
    "function getAllFaucetDetails() view returns (tuple(address faucetAddress, string name, address owner, address token)[] faucetDetails)",
];

const PLATFORM_BACKEND_ADDRESS = "0x9fBC2A0de6e5C5Fd96e8D11541608f5F328C0785";
const API_BASE_URL = "https://fauctdrop-backend.onrender.com"

// Suggested Tasks by Stage (kept as is)
const SUGGESTED_TASKS_BY_STAGE: Record<TaskStage, Array<Partial<QuestTask>>> = {
    Beginner: [
        { title: "Visit our Website", category: "social", action: "visit", targetPlatform: "Website", points: 30, verificationType: "manual_link" },
        { title: "Follow us on Twitter", category: "social", action: "follow", targetPlatform: "Twitter", points: 50, verificationType: "manual_link" },
        { title: "Join our Discord Server", category: "social", action: "join", targetPlatform: "Discord", points: 50, verificationType: "manual_link" },
        { title: "Like our Facebook Page", category: "social", action: "like", targetPlatform: "Facebook", points: 40, verificationType: "manual_link" },
        { title: "Subscribe to YouTube Channel", category: "social", action: "subscribe", targetPlatform: "Youtube", points: 60, verificationType: "manual_link" },
        { title: "Follow on Instagram", category: "social", action: "follow", targetPlatform: "Instagram", points: 40, verificationType: "manual_link" },
    ],
    Intermediate: [
        { title: "Refer 3 Friends", category: "referral", minReferrals: 3, points: 150, verificationType: "manual_link" },
        { title: "Share Campaign Poster", category: "content", action: "upload", points: 100, verificationType: "manual_upload", description: "Upload proof of sharing campaign poster" },
        { title: "Create Tutorial Video", category: "content", action: "upload", points: 200, verificationType: "manual_upload", description: "Create and share a tutorial video" },
        { title: "Write Blog Post", category: "content", action: "upload", points: 150, verificationType: "manual_upload", description: "Write a blog post about the project" },
    ],
    Advance: [
        { title: "Execute Swap on Uniswap", category: "swap", action: "swap", points: 200, verificationType: "auto_tx" },
        { title: "Stake Tokens", category: "trading", action: "stake", points: 250, verificationType: "auto_tx" },
        { title: "Provide Liquidity", category: "trading", action: "deposit", points: 300, verificationType: "auto_tx" },
    ],
    Legend: [
        { title: "Refer 10 Active Users", category: "referral", minReferrals: 10, points: 500, verificationType: "manual_link" },
        { title: "Execute Advanced Trading", category: "trading", action: "lend", points: 400, verificationType: "auto_tx" },
    ],
    Ultimate: [
        { title: "Become Ambassador", category: "general", points: 1000, verificationType: "manual_link", description: "Complete all requirements and apply for ambassador role" },
    ],
};
// --- HELPERS (kept as is) ---
const generateSocialTaskTitle = (platform: string, action: string): string => {
    if (!platform || !action) return "";
    const actionMap: Record<string, string> = {
        'follow': 'Follow',
        'retweet': 'Retweet/Share',
        'like': 'Like',
        'join': 'Join',
        'subscribe': 'Subscribe to',
        'visit': 'Visit',
        'swap': 'Execute Swap on',
        'stake': 'Stake Tokens on',
        'deposit': 'Deposit Assets on',
        'lend': 'Lend/Borrow on',
    };
    const capitalizedAction = actionMap[action] || action.charAt(0).toUpperCase() + action.slice(1);

    if (['follow', 'like', 'retweet'].includes(action) && platform === 'Twitter') {
        return `${capitalizedAction} our post on X (Twitter)`;
    }
    if (action === 'join' && platform === 'Discord') {
        return `Join our Official Discord Server`;
    }
    if (action === 'subscribe' && platform === 'Youtube') {
        return `Subscribe to our YouTube Channel`;
    }

    return `${capitalizedAction} our ${platform}`;
};


// --- NEW COMPONENT: Image Upload and Preview ---
interface ImageUploadFieldProps {
    imageUrl: string;
    onImageUrlChange: (url: string) => void;
    onFileUpload: (file: File) => Promise<void>;
    isUploading: boolean;
    uploadError: string | null;
    requiredResolution?: { width: number; height: number };
}

const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
    imageUrl, onImageUrlChange, onFileUpload, isUploading, uploadError, requiredResolution
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState(imageUrl);
    const [resolutionError, setResolutionError] = useState<string | null>(null);
    const requiredWidth = requiredResolution?.width || 1024;
    const requiredHeight = requiredResolution?.height || 1024;

    useEffect(() => {
        setPreviewUrl(imageUrl);
    }, [imageUrl]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setResolutionError(null);

        // 1. Client-side Resolution Check
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                if (img.width !== requiredWidth || img.height !== requiredHeight) {
                    setResolutionError(`Resolution must be ${requiredWidth}x${requiredHeight} pixels. Found ${img.width}x${img.height}.`);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = ""; // Clear file input
                    return;
                }
                // 2. Set preview and trigger upload
                setPreviewUrl(e.target?.result as string);
                onFileUpload(file);
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        onImageUrlChange("");
        setPreviewUrl(null);
        setResolutionError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const displayImageUrl = imageUrl || previewUrl;

    return (
        <div className="space-y-2">
            <Label htmlFor="fileUpload">Quest Image/Logo (Max 5MB, {requiredWidth}x{requiredHeight} required)</Label>
            
            <div className="flex items-center space-x-3">
                {/* File Input Trigger */}
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || !!resolutionError}
                    className="flex-grow"
                >
                    {isUploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Upload className="h-4 w-4 mr-2" />
                    )}
                    {isUploading ? "Uploading..." : imageUrl ? "Change Image" : "Upload Image (1024x1024)"}
                </Button>
                
                {/* Remove Button */}
                {imageUrl && (
                    <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={handleRemoveImage}
                        disabled={isUploading}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
                
                {/* Hidden File Input */}
                <Input
                    id="fileUpload"
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isUploading}
                />
            </div>

            {/* Preview and Error */}
            {(displayImageUrl || uploadError || resolutionError) && (
                <div className="flex items-start space-x-3 mt-2 border p-3 rounded-lg bg-white dark:bg-gray-800">
                    <div className="h-16 w-16 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border">
                        {displayImageUrl ? (
                            <img src={displayImageUrl} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                                No Preview
                            </div>
                        )}
                    </div>
                    {(uploadError || resolutionError) && (
                        <p className="text-xs text-red-500 flex-grow pt-1">
                            <AlertTriangle className="h-3 w-3 inline mr-1" />
                            {resolutionError || uploadError}
                        </p>
                    )}
                     {(!uploadError && !resolutionError && imageUrl) && (
                        <p className="text-xs text-green-500 flex-grow pt-1">
                            <Check className="h-3 w-3 inline mr-1" />
                            Image URL saved successfully.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};


// --- STEP 1: QUEST DETAILS ---
// Updated StepOneProps to include new image handling props
interface StepOneProps {
    newQuest: Omit<Quest, 'id' | 'creatorAddress' | 'stagePassRequirements'>;
    setNewQuest: React.Dispatch<React.SetStateAction<Omit<Quest, 'id' | 'creatorAddress' | 'stagePassRequirements'>>>;
    nameError: string | null;
    isCheckingName: boolean;
    isUploadingImage: boolean;
    uploadImageError: string | null;
    handleImageUpload: (file: File) => Promise<void>;
}
const StepOneDetails: React.FC<StepOneProps> = ({ newQuest, setNewQuest, nameError, isCheckingName, isUploadingImage, uploadImageError, handleImageUpload }) => (
    <Card>
        <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" /> Step 1: Basic Quest Details
            </CardTitle>
            <CardDescription>
                Define the campaign's core identity. The Title is also used as the Faucet name.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

            <div className="space-y-2">
                <Label htmlFor="title">Quest Title (also Faucet Name)</Label>
                <div className="relative">
                    <Input
                        id="title"
                        value={newQuest.title}
                        onChange={(e) => setNewQuest({...newQuest, title: e.target.value})}
                        placeholder="The FaucetDrop Launch Campaign"
                        className={
                            nameError
                                ? "border-red-500 pr-10"
                                : (!isCheckingName && newQuest.title.trim().length >= 3 && !nameError)
                                    ? "border-green-500 pr-10"
                                    : "pr-10"
                        }
                        disabled={isCheckingName}
                    />
                    {isCheckingName && (
                        <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-500" />
                    )}
                    {!isCheckingName && newQuest.title.trim().length >= 3 && (
                        nameError ? (
                            <AlertTriangle className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />
                        ) : (
                            <Check className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                        )
                    )}
                </div>
                {newQuest.title.trim().length > 0 && newQuest.title.trim().length < 3 && (
                    <p className="text-xs text-red-500">Quest name must be at least 3 characters long.</p>
                )}
                {nameError && newQuest.title.trim().length >= 3 && (
                    <p className="text-xs text-red-500">{nameError}</p>
                )}
            </div>
            
            {/* NEW IMAGE UPLOAD FIELD */}
            <ImageUploadField
                imageUrl={newQuest.imageUrl}
                onImageUrlChange={(url) => setNewQuest({...newQuest, imageUrl: url})}
                onFileUpload={handleImageUpload}
                isUploading={isUploadingImage}
                uploadError={uploadImageError}
                requiredResolution={{ width: 1024, height: 1024 }} // Set required resolution
            />
            
            <div className="space-y-2">
                <Label htmlFor="description">Quest Description</Label>
                <Textarea
                    id="description"
                    value={newQuest.description}
                    onChange={(e) => setNewQuest({...newQuest, description: e.target.value})}
                    placeholder="A campaign to reward early community members."
                    rows={3}
                />
            </div>
        </CardContent>
    </Card>
)

// --- STEP 2: REWARDS CONFIG ---
interface StepTwoProps {
    newQuest: Omit<Quest, 'id' | 'creatorAddress' | 'stagePassRequirements'>;
    setNewQuest: React.Dispatch<React.SetStateAction<Omit<Quest, 'id' | 'creatorAddress' | 'stagePassRequirements'>>>;
    chainId: number | null;
    network: Network | null; // Updated type
    selectedToken: TokenConfiguration | null;
    setSelectedToken: React.Dispatch<React.SetStateAction<TokenConfiguration | null>>;
    error: string | null;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
}
const StepTwoRewards: React.FC<StepTwoProps> = ({ newQuest, setNewQuest, chainId, network, selectedToken, setSelectedToken, setError }) => {
    const [isCustomToken, setIsCustomToken] = useState(false);
    const [customTokenAddress, setCustomTokenAddress] = useState('');
    const availableTokens = chainId ? ALL_TOKENS_BY_CHAIN[chainId] || [] : [];

    return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Coins className="h-5 w-5" /> Step 2: Rewards Configuration
            </CardTitle>
            <CardDescription>
                Define the rewards and the primary reward token for the Faucet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="space-y-2">
              <Label htmlFor="rewardPool">Reward Pool Description</Label>
              <Input
                id="rewardPool"
                value={newQuest.rewardPool}
                onChange={(e) => setNewQuest({...newQuest, rewardPool: e.target.value})}
                placeholder="5000 $FD tokens + 10 NFT spots"
              />
               <p className="text-xs text-muted-foreground">This is for display only. The reward token will be used for the Faucet deployment.</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="rewardToken">Reward Token ({network?.name || 'Unknown Chain'})</Label>
                <Select
                    value={isCustomToken ? "custom" : (selectedToken ? selectedToken.address : undefined)}
                    onValueChange={(value) => {
                        if (value === "custom") {
                            setIsCustomToken(true);
                            setSelectedToken(null);
                        } else {
                            const token = availableTokens.find(t => t.address === value);
                            if (token) {
                                setSelectedToken(token);
                                setIsCustomToken(false);
                                setCustomTokenAddress('');
                                setNewQuest(prev => ({
                                    ...prev,
                                    rewardTokenType: token.isNative ? 'native' : 'erc20',
                                    tokenAddress: token.address,
                                }));
                            }
                        }
                    }}
                    disabled={availableTokens.length === 0}
                >
                    <SelectTrigger>
                        <SelectValue>
                            {isCustomToken ? (
                                "Custom Token"
                            ) : selectedToken ? (
                                <span className="flex items-center gap-2">
                                    {selectedToken.name} ({selectedToken.symbol})
                                </span>
                            ) : (
                                availableTokens.length > 0 ? "Select reward token" : "No tokens available on this chain"
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {availableTokens.map((token) => (
                            <SelectItem key={token.address} value={token.address}>
                                <div className="flex items-center gap-2">
                                    {token.name} ({token.symbol}) {token.isNative && <Badge variant="secondary" className="text-xs">Native</Badge>}
                                </div>
                            </SelectItem>
                        ))}
                        <SelectItem value="custom">+ Custom Token</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {isCustomToken && (
                <div className="space-y-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
                    <h4 className="text-sm font-medium">Custom Token Address</h4>
                    <div className="space-y-2">
                        <Label className="text-xs">Token Contract Address</Label>
                        <Input
                            value={customTokenAddress}
                            onChange={(e) => setCustomTokenAddress(e.target.value)}
                            placeholder="0x..."
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (customTokenAddress && isAddress(customTokenAddress)) {
                                const fullCustom: TokenConfiguration = {
                                    address: customTokenAddress,
                                    name: 'Custom Token',
                                    symbol: 'CUST',
                                    decimals: 18,
                                    isNative: false,
                                };
                                setSelectedToken(fullCustom);
                                setIsCustomToken(false);
                                setCustomTokenAddress('');
                                setNewQuest(prev => ({
                                    ...prev,
                                    rewardTokenType: 'erc20',
                                    tokenAddress: fullCustom.address,
                                }));
                                setError(null);
                            } else {
                                setError("Please enter a valid token contract address.");
                            }
                        }}
                        disabled={!customTokenAddress || !isAddress(customTokenAddress)}
                        className="w-full"
                    >
                        Set Custom Token
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>
    )
}
// --- STEP 3: TASKS & STAGE REQUIREMENTS ---
interface StepThreeProps {
    newQuest: Omit<Quest, 'id' | 'creatorAddress' | 'stagePassRequirements'>;
    setNewQuest: React.Dispatch<React.SetStateAction<Omit<Quest, 'id' | 'creatorAddress' | 'stagePassRequirements'>>>;
    initialNewTaskForm: Partial<QuestTask>;
    error: string | null;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    stagePassRequirements: StagePassRequirements; // UPDATED
    setStagePassRequirements: React.Dispatch<React.SetStateAction<StagePassRequirements>>; // UPDATED
    stageTotals: Record<TaskStage, number>;
    stageTaskCounts: Record<TaskStage, number>;
    validateTask: () => boolean;
    handleAddTask: () => void;
    handleEditTask: (task: QuestTask) => void;
    handleUpdateTask: () => void;
    handleRemoveTask: (taskId: string) => void;
    handleStagePassRequirementChange: (stage: TaskStage, value: number) => void;
    isStageSelectable: (targetStage: TaskStage) => boolean;
    editingTask: QuestTask | null;
    setEditingTask: React.Dispatch<React.SetStateAction<QuestTask | null>>;
    newTask: Partial<QuestTask>;
    setNewTask: React.Dispatch<React.SetStateAction<Partial<QuestTask>>>;
    checkStagePassPointsValidity: () => boolean;
    getStageColor: (stage: TaskStage) => string;
    getCategoryColor: (category: string) => string;
    getVerificationIcon: (type: VerificationType) => React.ReactNode;
    handleUseSuggestedTask: (suggestedTask: Partial<QuestTask>) => void;
}
const StepThreeTasks: React.FC<StepThreeProps> = ({
    newQuest, setNewQuest, initialNewTaskForm, error, setError, stagePassRequirements,
    setStagePassRequirements, stageTotals, stageTaskCounts, validateTask, handleAddTask, handleEditTask,
    handleUpdateTask, handleUpdateTask: handleRemoveTask, handleStagePassRequirementChange, isStageSelectable,
    editingTask, setNewTask, newTask, checkStagePassPointsValidity, getStageColor, getCategoryColor, getVerificationIcon,
    setEditingTask, handleUseSuggestedTask, handleRemoveTask: handleRemoveTaskFromProps // Renamed to avoid collision
}) => {
    const getStageSelectStatus = (stage: TaskStage) => {
        const stageIndex = TASK_STAGES.indexOf(stage);

        if (editingTask && editingTask.stage === stage) return 'selectable';
        if (stageIndex === 0) return 'selectable';
        for (let i = 0; i < stageIndex; i++) {
            const prevStage = TASK_STAGES[i];
            const prevStageTaskCount = stageTaskCounts[prevStage];
            const prevStageRequirement = STAGE_TASK_REQUIREMENTS[prevStage];

            if (prevStageTaskCount < prevStageRequirement.min) {
                return 'locked';
            }
        }
        return 'selectable';
    };
    const isSocialOrReferral = newTask.category === 'social' || newTask.category === 'referral';
    const isTrading = newTask.category === 'trading' || newTask.category === 'swap';
    const isSocialTemplate = newTask.category === 'social';
    const isContentCategory = newTask.category === 'content';
    const getAvailableCategories = (stage: TaskStage): Array<QuestTask['category']> => {
        switch (stage) {
            case 'Beginner': return ['social'];
            case 'Intermediate': return ['referral', 'content'];
            case 'Advance': return ['swap', 'trading'];
            case 'Legend':
            case 'Ultimate': return ['social', 'referral', 'content', 'swap', 'trading', 'general'];
            default: return ['general'];
        }
    };
    const availableCategories = getAvailableCategories(newTask.stage || 'Beginner');
    const currentStageTaskCount =stageTaskCounts[newTask.stage || 'Beginner'];
    const currentStageRequirement = STAGE_TASK_REQUIREMENTS[newTask.stage || 'Beginner'];
    const isCurrentStageAtMax = currentStageTaskCount >= currentStageRequirement.max;
    const suggestedTasks = SUGGESTED_TASKS_BY_STAGE[newTask.stage || 'Beginner'] || [];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ListPlus className="h-5 w-5" />
                        {editingTask ? "Edit Task" : "Define New Task"}
                    </CardTitle>
                    <CardDescription>
                        Define the action, its stage, and the verification method.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="stage">Task Stage</Label>
                            <Select
                                value={newTask.stage || "Beginner"}
                                onValueChange={(value: TaskStage) => {
                                    const newCategories = getAvailableCategories(value);
                                    let newCategory = newTask.category;
                                    if (!newCategories.includes(newTask.category as any)) {
                                        newCategory = newCategories[0];
                                    } setNewTask(prev => ({...prev, stage: value, category: newCategory}));
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select stage" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TASK_STAGES.map(stage => {
                                        const status = getStageSelectStatus(stage);
                                        const taskCount = stageTaskCounts[stage];
                                        const requirement = STAGE_TASK_REQUIREMENTS[stage]; return (
                                            <SelectItem
                                                key={stage}
                                                value={stage}
                                                disabled={status === 'locked'}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {status === 'locked' ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                                    {stage}
                                                    <span className="text-xs text-muted-foreground">
                                                        ({taskCount}/{requirement.min}-{requirement.max})
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Select
                                value={newTask.category}
                                onValueChange={(value: any) => {
                                    const newCategory = value as QuestTask['category']; setNewTask(prev => ({
                                        ...prev,
                                        category: newCategory,
                                        minReferrals: newCategory === 'referral' ? (prev.minReferrals || 1) : undefined
                                    }));
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableCategories.map(cat => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="verificationType">Verification</Label>
                            <Select
                                value={newTask.verificationType || "manual_link"}
                                onValueChange={(value: any) => setNewTask({...newTask, verificationType: value})}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto_social" disabled={!isSocialOrReferral}>🤖 Auto (Social)</SelectItem>
                                    <SelectItem value="auto_tx" disabled={!isTrading}>💰 Auto (Tx)</SelectItem>
                                    <SelectItem value="manual_link">🔗 Manual (Link)</SelectItem>
                                    <SelectItem value="manual_upload">🖼️ Manual (Image)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {!editingTask && (
                        <div className={`p-3 rounded-lg border-2 ${
                            isCurrentStageAtMax
                                ? 'bg-red-50 border-red-300 dark:bg-red-900/20'
                                : currentStageTaskCount >= currentStageRequirement.min
                                    ? 'bg-green-50 border-green-300 dark:bg-green-900/20'
                                    : 'bg-blue-50 border-blue-300 dark:bg-blue-900/20'
                        }`}>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                    {newTask.stage || 'Beginner'} Stage: {currentStageTaskCount}/{currentStageRequirement.max} tasks
                                </span>
                                {isCurrentStageAtMax && <Lock className="h-4 w-4 text-red-500" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {isCurrentStageAtMax
                                    ? `Maximum tasks reached. Remove a task or select another stage.`
                                    : currentStageTaskCount < currentStageRequirement.min
                                        ? `Minimum ${currentStageRequirement.min} tasks required to unlock next stage.`
                                        : `Stage unlocked! You can add up to ${currentStageRequirement.max - currentStageTaskCount} more tasks.`
                                }
                            </p>
                        </div>
                    )}
                    {!editingTask && SUGGESTED_TASKS_BY_STAGE[newTask.stage || 'Beginner'].length > 0 && (
                        <div className="space-y-2 p-3 border rounded-lg bg-purple-50 dark:bg-purple-900/20">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <Zap className="h-4 w-4" /> Suggested Tasks for {newTask.stage}
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                                {SUGGESTED_TASKS_BY_STAGE[newTask.stage || 'Beginner'].map((task, idx) => (
                                    <Button
                                        key={idx}
                                        variant="outline"
                                        size="sm"
                                        className="justify-start text-left h-auto py-2"
                                        onClick={() => handleUseSuggestedTask(task)}
                                    >
                                        <div className="flex flex-col items-start w-full">
                                            <span className="font-medium text-xs">{task.title}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {task.points} pts • {task.category}
                                            </span>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                    {isSocialTemplate && (
                        <div className="space-y-3 p-3 border-2 border-blue-300 rounded-lg bg-blue-50 dark:bg-blue-900/50">
                            <h4 className="text-md font-semibold text-blue-700 dark:text-blue-200">Social Task Template</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Platform</Label>
                                    <Select
                                        value={newTask.targetPlatform}
                                        onValueChange={(value: SocialPlatform) => {
                                            setNewTask(prev => ({
                                                ...prev,
                                                targetPlatform: value,
                                                title: generateSocialTaskTitle(value, prev.action || 'follow'),
                                                description: `Complete the action on our ${value} channel/page.`,
                                            }));
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="select platform"/></SelectTrigger>
                                        <SelectContent>
                                            {SOCIAL_PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Action</Label>
                                    <Select
                                        value={newTask.action}
                                        onValueChange={(value: string) => {
                                            setNewTask(prev => ({
                                                ...prev,
                                                action: value,
                                                title: generateSocialTaskTitle(prev.targetPlatform || 'Twitter', value),
                                            }));
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="select action" /></SelectTrigger>
                                        <SelectContent>
                                            {SOCIAL_ACTIONS.map(a => <SelectItem key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Task Title (Auto-Generated)</Label>
                                <Input
                                    value={newTask.title || "Auto-generated based on selections"}
                                    disabled
                                    className="font-bold bg-white dark:bg-gray-800"
                                />
                            </div>
                        </div>
                    )}
                    {!isSocialTemplate && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="taskTitle">Task Title</Label>
                                <Input
                                    id="taskTitle"
                                    value={newTask.title || ""}
                                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                                    placeholder="Complete KYC Verification"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="taskDescription">Description / Guide</Label>
                                <Textarea
                                    id="taskDescription"
                                    value={newTask.description || ""}
                                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                                    placeholder="Detailed steps for completing the task."
                                    rows={2}
                                />
                            </div>
                        </>
                    )} <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="url">Action URL / Guide Link</Label>
                            <Input
                                id="url"
                                value={newTask.url || ""}
                                onChange={(e) => setNewTask({...newTask, url: e.target.value})}
                                placeholder="https://x.com/faucetdrops/status/..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="points">Task Points</Label>
                            <Input
                                id="points"
                                type="number"
                                value={newTask.points || 100}
                                onChange={(e) => setNewTask({...newTask, points: parseInt(e.target.value)})}
                                min="1"
                            />
                        </div>
                    </div>
                    {newTask.category === 'referral' && (
                               <div className="space-y-2 p-3 border rounded-lg bg-orange-50 dark:bg-orange-900/50">
                               <div className="flex items-center gap-2 text-sm font-medium text-orange-800 dark:text-orange-200">
                                   <Share2 className="h-4 w-4" /> Referral Settings
                               </div>
                               <Label className="text-xs">Minimum Required Referrals</Label>
                               <Input
                                   type="number"
                                   value={newTask.minReferrals || 1}
                                   onChange={(e) => setNewTask({...newTask, minReferrals: parseInt(e.target.value)})}
                                   min="1"
                                   placeholder="e.g. 5"
                               />
                           </div>
                    )}
                    {newTask.verificationType === 'auto_social' && (
                        <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
                            <div className="space-y-2 col-span-2">
                                <Label>Action Target URL/Handle</Label>
                                <Input
                                    value={newTask.url || ""}
                                    onChange={(e) => setNewTask({...newTask, url: e.target.value})}
                                    placeholder="Enter the full URL of the post or page to follow/like/join"
                                />
                            </div>
                        </div>
                    )} {newTask.verificationType === 'auto_tx' && (
                        <div className="grid grid-cols-3 gap-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
                            <div className="space-y-2">
                                <Label>Chain ID</Label>
                                <Input
                                    value={newTask.targetChainId || ""}
                                    onChange={(e) => setNewTask({...newTask, targetChainId: e.target.value})}
                                    placeholder="8453 (Base)"
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>Target Contract Address</Label>
                                <Input
                                    value={newTask.targetContractAddress || ""}
                                    onChange={(e) => setNewTask({...newTask, targetContractAddress: e.target.value})}
                                    placeholder="0x..."
                                />
                            </div>
                            <div className="space-y-2 col-span-3">
                                <Label>Transaction Action</Label>
                                <Select
                                    value={newTask.action || "swap"}
                                    onValueChange={(value: string) => setNewTask({...newTask, action: value})}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {TRADING_ACTIONS.map(a => <SelectItem key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )} <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={newTask.required || false}
                                onCheckedChange={(checked) => setNewTask({...newTask, required: checked})}
                            />
                            <Label>Required Task</Label>
                        </div> <Button
                            onClick={editingTask ? handleUpdateTask : handleAddTask}
                            disabled={
                                !newTask.title ||
                                !newTask.url ||
                                newTask.points === undefined ||
                                newTask.points <= 0 ||
                                (!editingTask && isCurrentStageAtMax)
                            }
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {editingTask ? "Update Task" : "Add Task"}
                        </Button>
                    </div> {editingTask && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setNewTask(initialNewTaskForm)
                                setEditingTask(null)
                            }}
                            className="w-full"
                        >
                            Cancel Edit
                        </Button>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Trophy className="h-5 w-5" /> Stage Pass Requirements
                    </CardTitle>
                    <CardDescription>
                        Set minimum points to pass a stage and unlock the next.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-2 space-y-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground">
                            Pass Points must be &gt; 0 and max 70% of the stage's total points.
                        </p> {TASK_STAGES.map((stage) => {
                            const totalPoints = stageTotals[stage];
                            const taskCount = stageTaskCounts[stage];
                            const requirement = STAGE_TASK_REQUIREMENTS[stage];
                            const maxAllowed = Math.floor(totalPoints * MAX_PASS_POINT_RATIO);
                            const requiredPass = stagePassRequirements[stage];
                            const isInvalid = totalPoints > 0 && (requiredPass > maxAllowed || requiredPass <= 0);
                            const meetsMinTasks = taskCount >= requirement.min; return (
                                <div key={stage} className={`flex justify-between items-center gap-3 p-2 rounded-md ${
                                    totalPoints > 0
                                        ? meetsMinTasks
                                            ? 'bg-green-50 border border-green-200 dark:bg-green-900/20'
                                            : 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20'
                                        : 'bg-gray-100 dark:bg-gray-800'
                                }`}>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm flex items-center gap-2">
                                            {stage} Stage
                                            {!meetsMinTasks && taskCount > 0 && (
                                                <Lock className="h-3 w-3 text-yellow-600" />
                                            )}
                                            {meetsMinTasks && <Unlock className="h-3 w-3 text-green-600" />}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Tasks: {taskCount}/{requirement.min}-{requirement.max} | Points: {totalPoints} {totalPoints > 0 && `(Max Pass: ${maxAllowed})`}
                                        </span>
                                        {isInvalid && (
                                            <p className="text-xs text-red-500">Pass required: 1 - {maxAllowed} Pts.</p>
                                        )}
                                        {!meetsMinTasks && taskCount > 0 && (
                                            <p className="text-xs text-yellow-600">Add {requirement.min - taskCount} more task(s) to unlock next stage</p>
                                        )}
                                    </div>
                                    <Input
                                        type="number"
                                        value={requiredPass || 0}
                                        onChange={(e) => handleStagePassRequirementChange(stage, parseInt(e.target.value) || 0)}
                                        min={totalPoints > 0 ? 1 : 0}
                                        max={maxAllowed || undefined}
                                        disabled={totalPoints === 0}
                                        className={`w-24 text-right ${isInvalid ? 'border-red-500' : ''}`}
                                    />
                                </div>
                            );
                        })}
                    </div> <h3 className="text-md font-semibold mt-4 flex items-center gap-2">
                        <ListPlus className="h-4 w-4" /> Current Tasks Summary ({newQuest.tasks.length})
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {newQuest.tasks.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                                No tasks added yet.
                            </div>
                        ) : (
                            TASK_STAGES.map(stage => {
                                const tasksInStage = newQuest.tasks.filter(t => t.stage === stage);
                                if (tasksInStage.length === 0) return null; return (
                                    <div key={stage} className="p-3 border rounded-lg">
                                        <h5 className="font-medium text-sm mb-2 flex items-center justify-between">
                                            <Badge className={getStageColor(stage)}>{stage}</Badge>
                                            <span className="text-xs text-muted-foreground">{stageTotals[stage]} Points</span>
                                        </h5>
                                        <div className="space-y-1">
                                            {tasksInStage.map(task => (
                                                <div key={task.id} className="flex justify-between items-center text-xs p-1 bg-gray-50 dark:bg-gray-800 rounded">
                                                    <span className="truncate flex items-center gap-1">
                                                        {task.required && <span className="text-red-500 font-bold">*</span>}
                                                        {task.title}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary" className={`text-xs ${getCategoryColor(task.category)}`}>{task.category}</Badge>
                                                        <span className="text-green-600 font-semibold">{task.points} Pts</span>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditTask(task)}><Settings className="h-3 w-3" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleRemoveTaskFromProps(task.id)}><Trash2 className="h-3 w-3" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
// --- STEP 4: PREVIEW AND LAUNCH ---
interface StepFourProps {
    newQuest: Omit<Quest, 'id' | 'creatorAddress' | 'stagePassRequirements'>;
    stageTotals: Record<TaskStage, number>;
    stagePassRequirements: StagePassRequirements; // UPDATED
    selectedToken: TokenConfiguration | null;
    network: Network | null;
    isConnected: boolean;
    isSaving: boolean;
    isSaveDisabled: boolean;
    handleCreateQuest: () => Promise<void>;
    getStageColor: (stage: TaskStage) => string;
}
const StepFourPreview: React.FC<StepFourProps> = ({
    newQuest, stageTotals, stagePassRequirements, selectedToken, network,
    isConnected, isSaving, isSaveDisabled, handleCreateQuest, getStageColor
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="h-5 w-5" /> Step 4: Preview & Launch
                </CardTitle>
                <CardDescription>
                    Review your quest details and deploy the Faucet smart contract to launch the campaign.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Quest Summary */}
                <div className="border p-4 rounded-lg space-y-3">
                    <h3 className="text-xl font-bold">{newQuest.title}</h3>
                    <div className="flex space-x-4">
                        {newQuest.imageUrl && (
                            <img src={newQuest.imageUrl} alt="Quest Logo" className="h-16 w-16 object-cover rounded-md" />
                        )}
                        <p className="text-muted-foreground">{newQuest.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3">
                        <div>
                            <p className="text-sm font-medium">Reward Token</p>
                            <p className="text-lg font-bold flex items-center gap-2">
                                <Coins className="h-5 w-5 text-yellow-600" />
                                {selectedToken ? `${selectedToken.name} (${selectedToken.symbol})` : 'TBD / Custom'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Reward Pool</p>
                            <p className="text-lg font-bold">{newQuest.rewardPool || 'Not Specified'}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Network</p>
                            <p className="font-semibold">{network?.name || 'Unknown'}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Duration</p>
                            <p className="font-semibold">{newQuest.startDate} to {newQuest.endDate}</p>
                        </div>
                    </div>
                </div>
                {/* Stages and Tasks Preview */}
                <div className="space-y-3">
                    <h4 className="text-lg font-semibold border-b pb-2">Stages & Tasks</h4>
                    {TASK_STAGES.map(stage => {
                        const tasksInStage = newQuest.tasks.filter(t => t.stage === stage);
                        const totalPoints = stageTotals[stage];
                        const requiredPass = stagePassRequirements[stage];

                        if (tasksInStage.length === 0) return null;
                        return (
                            <div key={stage} className="p-3 border rounded-lg">
                                <h5 className="font-bold text-md flex items-center justify-between">
                                    <Badge className={getStageColor(stage)}>{stage} Stage</Badge>
                                    <span className="text-sm font-semibold">Pass: {requiredPass} / Total: {totalPoints} Pts</span>
                                </h5>
                                <ul className="list-disc pl-5 text-sm mt-2 space-y-1">
                                    {tasksInStage.map(task => (
                                        <li key={task.id}>
                                            <span className="font-medium">{task.title}</span> ({task.points} Pts)
                                            {task.required && <span className="text-red-500 font-bold ml-1">(Required)</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )
                    })}
                </div>
                {/* Launch Button */}
                <Button
                    onClick={handleCreateQuest}
                    disabled={isSaveDisabled}
                    className="w-full mt-6 text-lg py-6"
                >
                    {isConnected ? (
                        isSaving ? (
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        ) : (
                            <Zap className="h-5 w-5 mr-2" />
                        )
                    ) : (
                        <Wallet className="h-5 w-5 mr-2" />
                    )}
                    {isConnected ? `Launch Quest & Deploy Faucet` : "Connect Wallet to Deploy"}
                </Button>
            </CardContent>
        </Card>
    )
}

// --- MAIN COMPONENT: QuestCreator ---
export default function QuestCreator() {
    // --- LIVE HOOKS ---
    const { address, isConnected, chainId, isConnecting: isWalletConnecting, provider: walletProvider } = useWallet();
    
    // Use local network lookup instead of a separate provider hook
    const network = useMemo(() => getNetworkByChainId(chainId), [chainId]); 

    // --- WIZARD STATE ---
    const [step, setStep] = useState(1);
    const maxSteps = 4;
    // --- EXISTING STATE ---
    const [newQuest, setNewQuest] = useState<Omit<Quest, 'id' | 'creatorAddress' | 'stagePassRequirements'>>(initialNewQuest)
    const [newTask, setNewTask] = useState<Partial<QuestTask>>(initialNewTaskForm)
    const [editingTask, setEditingTask] = useState<QuestTask | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const [isCheckingName, setIsCheckingName] = useState(false);
    const [stagePassRequirements, setStagePassRequirements] = useState<StagePassRequirements>(initialStagePassRequirements); // UPDATED type
    // --- TOKEN STATE ---
    const [selectedToken, setSelectedToken] = useState<TokenConfiguration | null>(null);
    // --- NEW IMAGE UPLOAD STATE ---
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [uploadImageError, setUploadImageError] = useState<string | null>(null);


    const availableTokens = chainId ? ALL_TOKENS_BY_CHAIN[chainId] || [] : [];

    useEffect(() => {
        if (chainId && availableTokens.length > 0 && !selectedToken) {
            const initialToken = availableTokens.find(t => t.isNative) || availableTokens[0];
            setSelectedToken(initialToken || null);
            setNewQuest(prev => ({
                ...prev,
                rewardTokenType: initialToken?.isNative ? 'native' : 'erc20',
                tokenAddress: initialToken?.address || ZeroAddress,
            }));
        } else if (!chainId) {
            setSelectedToken(null);
            setNewQuest(initialNewQuest);
        }
    }, [chainId, selectedToken, availableTokens]);

    const FAUCET_FACTORY_ADDRESS = getFactoryAddress(FAUCET_TYPE_CUSTOM, network);
    const isFactoryAvailableOnChain = !!FAUCET_FACTORY_ADDRESS && !!network;

    // --- DYNAMIC CALCULATION: Stage Total Points & Task Counts ---
    const stageTotals = useMemo(() => {
        const newTotals: Record<TaskStage, number> = { Beginner: 0, Intermediate: 0, Advance: 0, Legend: 0, Ultimate: 0, };
        newQuest.tasks.forEach(task => { newTotals[task.stage] += task.points; });
        return newTotals;
    }, [newQuest.tasks]);

    const stageTaskCounts = useMemo(() => {
        const counts: Record<TaskStage, number> = { Beginner: 0, Intermediate: 0, Advance: 0, Legend: 0, Ultimate: 0, };
        newQuest.tasks.forEach(task => { counts[task.stage]++; });
        return counts;
    }, [newQuest.tasks]);

    // --- Name Validation: Updated to use imported function ---
    const validateFaucetNameAcrossFactories = useCallback(async (nameToValidate: string) => {
        console.log(`[QuestCreator: validateFaucetNameAcrossFactories] Checking name: "${nameToValidate}"`)

        if (!nameToValidate.trim() || !isConnected || !chainId || !network || !walletProvider) {
            console.log('[QuestCreator: validateFaucetNameAcrossFactories] Skipping check (Missing connection/network data)')
            setNameError(null); return;
        }

        setIsCheckingName(true); setNameError(null);

        try {
            console.log(`[QuestCreator: validateFaucetNameAcrossFactories] Calling external checkFaucetNameExists...`);
            
            const result: NameValidationResult = await checkFaucetNameExists(
                walletProvider as BrowserProvider, 
                network,       
                nameToValidate
            );

            if (result.exists && result.existingFaucet) {
                console.log(`[QuestCreator: validateFaucetNameAcrossFactories] ❌ Conflict found: ${result.existingFaucet.name}`);
                setNameError(`The name "${result.existingFaucet.name}" is already in use by a deployed Faucet.`);
            } else if (result.warning) {
                console.warn(`[QuestCreator: validateFaucetNameAcrossFactories] Warning during check: ${result.warning}`);
                setNameError(`Validation check returned a warning: ${result.warning}.`);
            } else {
                console.log(`[QuestCreator: validateFaucetNameAcrossFactories] ✅ Name is unique.`);
                setNameError(null);
            }
        } catch (e: any) {
            console.error("❌ [QuestCreator: validateFaucetNameAcrossFactories] Error checking name uniqueness:", e.message);
            setNameError("Error checking name uniqueness on-chain. Try again or check wallet network.");
        } finally {
            setIsCheckingName(false);
            console.log('[QuestCreator: validateFaucetNameAcrossFactories] Check finished.')
        }
    }, [isConnected, chainId, network, walletProvider]);

    useEffect(() => {
        const title = newQuest.title.trim();
        if (title.length < 3 || !isConnected || !network) { 
            setNameError(null); 
            return; 
        }
        const delayCheck = setTimeout(() => { validateFaucetNameAcrossFactories(title); }, 500);
        return () => clearTimeout(delayCheck);
    }, [newQuest.title, isConnected, network, validateFaucetNameAcrossFactories]);

    // --- Validation Helpers (implementation kept short for review) ---
    const validateTask = useCallback((): boolean => { 
        const isDuplicate = newQuest.tasks.some(t => {
            if (editingTask && t.id === editingTask.id) return false;
            return (newTask.title && t.title.toLowerCase() === newTask.title.trim().toLowerCase())
                || (newTask.url && t.url.toLowerCase() === newTask.url.trim().toLowerCase())
                || (newTask.description && t.description?.toLowerCase() === newTask.description?.trim().toLowerCase());
        });
        if (isDuplicate) { setError("A task already has the same Title, Description, or URL. Quest tasks must be unique."); return false; }
        if (!newTask.title || !newTask.url || newTask.points === undefined || newTask.points <= 0 || !newTask.stage) { setError("Please fill in all required task fields: Title, URL, Points (must be > 0), and Stage."); return false; }
        if (newTask.category !== 'social' && newTask.category !== 'referral' && !newTask.description) { setError("Please provide a detailed description for non-template tasks."); return false; }
        if (newTask.category === 'referral' && (newTask.minReferrals === undefined || newTask.minReferrals <= 0)) { setError("For 'referral' tasks, please specify a minimum required number of referrals (greater than 0)."); return false; }
        if (!editingTask) {
            const currentStageCount = stageTaskCounts[newTask.stage as TaskStage];
            const maxAllowed = STAGE_TASK_REQUIREMENTS[newTask.stage as TaskStage].max;
            if (currentStageCount >= maxAllowed) { setError(`Cannot add more tasks to ${newTask.stage} stage. Maximum ${maxAllowed} tasks allowed.`); return false; }
        }
        setError(null); return true;
    }, [newQuest.tasks, editingTask, newTask, stageTaskCounts]);
    
    const checkStagePassPointsValidity = useCallback((): boolean => { 
        for (const stage of TASK_STAGES) {
            const totalPoints = stageTotals[stage]; const requiredPass = stagePassRequirements[stage];
            if (totalPoints > 0) {
                const maxAllowed = Math.floor(totalPoints * MAX_PASS_POINT_RATIO);
                if (requiredPass > maxAllowed || requiredPass <= 0) { return false; }
            }
        }
        return true;
    }, [stageTotals, stagePassRequirements]);

    const validateStagePassPoints = useCallback((): boolean => { 
        let isValid = true;
        for (const stage of TASK_STAGES) {
            const totalPoints = stageTotals[stage]; const requiredPass = stagePassRequirements[stage];
            if (totalPoints > 0) {
                const maxAllowed = Math.floor(totalPoints * MAX_PASS_POINT_RATIO);
                if (requiredPass > maxAllowed || requiredPass <= 0) {
                    const errorMessage = `Stage "${stage}" Pass Points (${requiredPass}) must be > 0 and cannot exceed 70% of its total points (${totalPoints}). Expected max point: ${maxAllowed}.`;
                    setError(errorMessage); isValid = false; break;
                }
            }
        }
        if (isValid) setError(null); return isValid;
    }, [stageTotals, stagePassRequirements, setError]);

    const validateStageTaskRequirements = useCallback((): boolean => { 
        let isValid = true;
        for (const stage of TASK_STAGES) {
            const taskCount = stageTaskCounts[stage]; const requirement = STAGE_TASK_REQUIREMENTS[stage];
            if (taskCount > 0 && taskCount < requirement.min) { 
                setError(`Stage "${stage}" requires at least ${requirement.min} tasks. Currently has ${taskCount}.`); 
                isValid = false; 
                break;
            }
        }
        if (isValid) setError(null); return isValid;
    }, [stageTaskCounts, setError]);
    
    const isStageSelectable = useCallback((targetStage: TaskStage): boolean => { 
        const targetIndex = TASK_STAGES.indexOf(targetStage);
        if (targetIndex === 0 || (editingTask && editingTask.stage === targetStage)) { return true; }
        for (let i = 0; i < targetIndex; i++) {
            const prevStage = TASK_STAGES[i];
            const prevStageTaskCount = stageTaskCounts[prevStage];
            const prevStageRequirement = STAGE_TASK_REQUIREMENTS[prevStage];
            if (prevStageTaskCount < prevStageRequirement.min) { return false; }
        }
        return true;
    }, [stageTaskCounts, editingTask]);

    // --- Task Handlers (omitted implementation for brevity, assumed correct) ---
    const handleUseSuggestedTask = (suggestedTask: Partial<QuestTask>) => { 
        setNewTask({ ...initialNewTaskForm, ...suggestedTask, stage: newTask.stage || 'Beginner', id: undefined, });
    };
   const handleAddTask = () => {
        if (!validateTask()) return
        const task: QuestTask = {
            ...initialNewTaskForm,
            id: Date.now().toString(),
            title: newTask.title!,
            description: newTask.category === 'social' ? (newTask.description || generateSocialTaskTitle(newTask.targetPlatform || 'Website', newTask.action || 'visit')) : newTask.description!,
            points: newTask.points!,
            required: newTask.required!,
            category: newTask.category!,
            url: newTask.url!,
            action: newTask.action!,
            verificationType: newTask.verificationType!,
            targetPlatform: newTask.targetPlatform,
            targetHandle: newTask.targetHandle,
            targetContractAddress: newTask.targetContractAddress,
            targetChainId: newTask.targetChainId,
            stage: newTask.stage!,
            minReferrals: newTask.category === 'referral' ? newTask.minReferrals : undefined,
        }
        setNewQuest(prev => ({ ...prev, tasks: [...prev.tasks, task] }))
        setNewTask(initialNewTaskForm)
    }
    const handleUpdateTask = () => {
        if (!editingTask) return;
        if (!validateTask()) return;
        const updatedTask: QuestTask = {
            ...editingTask,
            ...newTask,
            id: editingTask.id,
            points: newTask.points!,
            stage: newTask.stage!,
            description: newTask.category === 'social' ? (newTask.description || generateSocialTaskTitle(newTask.targetPlatform || 'Website', newTask.action || 'visit')) : newTask.description!,
            minReferrals: newTask.category === 'referral' ? newTask.minReferrals : undefined,
        }
        setNewQuest(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === editingTask.id ? updatedTask : t) }))
        setEditingTask(null)
        setNewTask(initialNewTaskForm)
    }
    
    const handleEditTask = (task: QuestTask) => { setEditingTask(task); setNewTask({ ...task, minReferrals: task.category === 'referral' ? task.minReferrals : undefined, }); };
    const handleRemoveTask = (taskId: string) => { 
        setNewQuest(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) })) 
        if (editingTask && editingTask.id === taskId) {
            setEditingTask(null);
            setNewTask(initialNewTaskForm);
        }
    };
    const handleStagePassRequirementChange = (stage: TaskStage, value: number) => { setStagePassRequirements(prev => ({ ...prev, [stage]: value, })); };
    
    // --- Render Logic Helpers (REQUIRED FIX) ---
    const getStageColor = (stage: TaskStage) => {
        switch (stage) {
            case 'Beginner': return 'bg-green-500 hover:bg-green-600'; case 'Intermediate': return 'bg-blue-500 hover:bg-blue-600';
            case 'Advance': return 'bg-purple-500 hover:bg-purple-600'; case 'Legend': return 'bg-yellow-500 hover:bg-yellow-600';
            case 'Ultimate': return 'bg-red-500 hover:bg-red-600'; default: return 'bg-gray-500 hover:bg-gray-600';
        }
    }
    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'social': return 'bg-blue-100 text-blue-800'; case 'trading': return 'bg-green-100 text-green-800';
            case 'swap': return 'bg-purple-100 text-purple-800'; case 'referral': return 'bg-orange-100 text-orange-800';
            case 'content': return 'bg-pink-100 text-pink-800'; default: return 'bg-gray-100 text-gray-800';
        }
    }
    const getVerificationIcon = (type: VerificationType) => {
        switch (type) {
            case 'auto_social': return <Zap className="h-4 w-4 text-blue-500" />; case 'auto_tx': return <Wallet className="h-4 w-4 text-green-500" />;
            case 'manual_link': return <Link className="h-4 w-4 text-yellow-500" />; case 'manual_upload': return <Upload className="h-4 w-4 text-red-500" />;
            default: return <Settings className="h-4 w-4 text-gray-500" />;
        }
    }
    // --- End Render Logic Helpers ---


    // --- NEW IMAGE UPLOAD HANDLER ---
    const handleImageUpload = useCallback(async (file: File) => {
        setIsUploadingImage(true);
        setUploadImageError(null);
        
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload-image`, {
                method: 'POST',
                // Content-Type header for FormData is omitted; the browser sets it automatically.
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to upload image.');
            }

            const data = await response.json();
            
            // Set the new URL from the backend response
            setNewQuest(prev => ({ ...prev, imageUrl: data.imageUrl }));
            setUploadImageError(null);
            
            // Do not show an alert, let the visual cue handle it
        } catch (e: any) {
            console.error('❌ Image upload failed:', e);
            setUploadImageError(e.message || "Failed to upload image. Check console for details.");
            setNewQuest(prev => ({ ...prev, imageUrl: initialNewQuest.imageUrl }));
        } finally {
            setIsUploadingImage(false);
        }
    }, [setNewQuest]);


    // --- Web3 Logic: Faucet Deployment - Updated to use imported function ---
    const handleCreateCustomFaucet = async (questName: string, token: string) => {
        if (!address || !isConnected || !FAUCET_FACTORY_ADDRESS || !walletProvider) {
            setError("Wallet or provider is not ready for deployment."); return null;
        }

        try {
            const newFaucetAddress = await createCustomFaucet(
                walletProvider as BrowserProvider,
                FAUCET_FACTORY_ADDRESS,
                questName,
                token
            );
            
            if (newFaucetAddress) { return newFaucetAddress; }
            throw new Error("Deployment successful, but address retrieval failed.");

        } catch (error: any) {
            console.error('❌ Error deploying custom faucet:', error);
            setError(`Deployment failed: ${error.message || 'Unknown transaction error'}`); return null;
        }
    };
    
    // --- Main Save/Launch Handler (updated to use new deployment logic) ---
    const handleCreateQuest = async () => {
        console.log('[QuestCreator: handleCreateQuest] Attempting to launch quest.')
        
        if (!selectedToken) { setError("Please select a valid reward token (Step 2)."); setStep(2); return; }
        if (!address || !isConnected) { setError("You must connect your wallet to deploy the smart contract and create the quest."); return; }
        if (newQuest.tasks.length === 0) { setError("Please add at least one task to the quest (Step 3)."); setStep(3); return; }
        if (!isFactoryAvailableOnChain) { setError(`Cannot deploy: No Custom Faucet Factory configured for ${network?.name || 'this network'}.`); return; }
        if (isCheckingName || nameError || newQuest.title.trim().length < 3) { setError(nameError || "Title must be valid and checked (Step 1)."); setStep(1); return; }
        if (!validateStagePassPoints()) { setStep(3); return; }
        if (!validateStageTaskRequirements()) { setStep(3); return; }
        if (isUploadingImage || uploadImageError) { setError(uploadImageError || "Please wait for image upload to complete or fix upload error."); setStep(1); return; }

        setError(null); setIsSaving(true);
        const tokenToDeploy = selectedToken.address;

        const faucetAddress = await handleCreateCustomFaucet(newQuest.title, tokenToDeploy);

        if (!faucetAddress) { setIsSaving(false); return; }

        // Final Quest structure for the backend
        const questData: Quest = {
            id: Date.now().toString(), creatorAddress: address, ...newQuest, faucetAddress: faucetAddress,
            tokenAddress: tokenToDeploy, rewardTokenType: selectedToken.isNative ? 'native' : 'erc20',
            stagePassRequirements: stagePassRequirements, // UPDATED: Pass the state value
            imageUrl: newQuest.imageUrl,
        };
        
        // IMPORTANT: The backend API endpoint is '/api/quests', not '/api/quests/create'
        try {
            const response = await fetch(`${API_BASE_URL}/api/quests`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(questData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save quest metadata.');
            }
            console.log(`[QuestCreator: handleCreateQuest] ✅ Quest metadata saved to backend.`)
            alert(`Quest created on ${network?.name} and Faucet deployed successfully at ${faucetAddress}! Remember to fund the Faucet.`);
            // Reset state
            setNewQuest(initialNewQuest); 
            setNewTask(initialNewTaskForm); 
            setStagePassRequirements(initialStagePassRequirements); 
            setSelectedToken(null);
            setStep(1);
        } catch (e: any) {
            console.error('❌ [QuestCreator: handleCreateQuest] Quest save failed:', e);
            setError(`Backend Error saving quest details: ${e.message}. Faucet deployed at ${faucetAddress}.`);
        } finally {
            setIsSaving(false);
        }
    }
    
    // --- 2. FIX: Next Button Handler ---
    const handleNext = () => {
        let isStepValid = true;

        if (step === 1) {
            if (!newQuest.title.trim() || newQuest.title.trim().length < 3) {
                setError("Step 1: Quest Title must be at least 3 characters long.");
                isStepValid = false;
            } else if (isCheckingName || nameError) {
                setError(nameError || "Step 1: Please wait for name check to complete or resolve the error.");
                isStepValid = false;
            } else if (!newQuest.imageUrl) {
                setError("Step 1: Please upload a Quest Image.");
                isStepValid = false;
            } else if (isUploadingImage || uploadImageError) {
                setError(uploadImageError || "Step 1: Please wait for image upload to complete or fix upload error.");
                isStepValid = false;
            }
        }
        
        if (step === 2) {
            if (!selectedToken) {
                setError("Step 2: Please select a reward token.");
                isStepValid = false;
            }
        }
        
        if (step === 3) {
            // Note: validateStagePassPoints and validateStageTaskRequirements
            // set the global 'error' state internally if they return false.
            if (newQuest.tasks.length === 0) {
                setError("Step 3: Please add at least one task to the quest.");
                isStepValid = false;
            } else if (!validateStagePassPoints()) {
                isStepValid = false;
            } else if (!validateStageTaskRequirements()) {
                isStepValid = false;
            }
        }

        if (isStepValid) {
            setError(null); // Clear overall error only on success
            setStep(prev => Math.min(prev + 1, maxSteps));
        }
    }
    
    const handleBack = () => {
        setStep(prev => Math.max(prev - 1, 1));
        setError(null);
    }
    
    
    // 1. Show Loading State if wallet is connecting
    if (isWalletConnecting) {
        return (
            <>
                <Header pageTitle="Quest creator page" />
                <Card className="max-w-md mx-auto mt-8">
                    <CardContent className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mr-2" />
                        <span>Connecting wallet and loading network data...</span>
                    </CardContent>
                </Card>
            </>
        )
    }

    // 2. Show Connect Wallet State if not connected
    if (!isConnected) {
        return (
            <>
                <Header pageTitle="Quest creator page" />
                <div className="max-w-6xl mx-auto p-6 space-y-6">
                    <h1 className="text-2xl font-bold mb-4">Create New Quest Campaign</h1>
                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Info:</strong>
                        <span className="block sm:inline ml-2">Please connect your wallet to create a quest campaign.</span>
                    </div>
                </div>
            </>
        )
    }
    
    // 3. Define the main disable flag (includes the Factory check)
    const isSaveDisabled = isSaving || newQuest.tasks.length === 0 || !isFactoryAvailableOnChain || !isConnected || !selectedToken || !checkStagePassPointsValidity() || !!nameError || isCheckingName || newQuest.title.trim().length < 3 || isUploadingImage || !newQuest.imageUrl;

    return (
        <>
            <Header pageTitle="Quest creator page" /> {/* 1. ADDED HEADER */}
            <div className="max-w-6xl mx-auto p-6 space-y-6">
                <h1 className="text-2xl font-bold mb-4">Create New Quest Campaign</h1>
                
                {/* Inline Error/Warning Messages */}
                {isConnected && error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline ml-2">{error}</span>
                    </div>
                )}
                
                {/* INLINE WARNING: Show non-blocking warning if factory is missing */}
                {isConnected && !isFactoryAvailableOnChain && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Warning:</strong>
                        <span className="block sm:inline ml-2">
                            The current network **({network?.name || 'Unknown'})** is not configured for Quest Deployment. Please switch to Celo, Lisk, Arbitrum, or Base. The Launch button is disabled.
                        </span>
                    </div>
                )}
                
                {/* Step Indicator */}
                <div className="flex justify-between items-center max-w-xl mx-auto border-b pb-4 mb-4">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                                s === step ? 'bg-primary text-primary-foreground scale-110' : s < step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                                }`}>
                                {s < step ? <Check className="h-5 w-5" /> : s}
                            </div>
                            <span className={`text-xs mt-1 ${s === step ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                                {s === 1 ? 'Details' : s === 2 ? 'Rewards' : s === 3 ? 'Tasks' : 'Launch'}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="min-h-[400px]">
                    {step === 1 && (
                        <StepOneDetails 
                            newQuest={newQuest} 
                            setNewQuest={setNewQuest} 
                            nameError={nameError} 
                            isCheckingName={isCheckingName}
                            isUploadingImage={isUploadingImage}
                            uploadImageError={uploadImageError}
                            handleImageUpload={handleImageUpload}
                        />
                    )}
                    {step === 2 && (
                        <StepTwoRewards newQuest={newQuest} setNewQuest={setNewQuest} chainId={chainId} network={network} selectedToken={selectedToken} setSelectedToken={setSelectedToken} error={error} setError={setError} />
                    )}
                    {step === 3 && (
                        <StepThreeTasks
                            newQuest={newQuest} setNewQuest={setNewQuest} initialNewTaskForm={initialNewTaskForm} error={error} setError={setError}
                            stagePassRequirements={stagePassRequirements} setStagePassRequirements={setStagePassRequirements}
                            stageTotals={stageTotals} stageTaskCounts={stageTaskCounts} validateTask={validateTask} handleAddTask={handleAddTask}
                            handleEditTask={handleEditTask} handleUpdateTask={handleUpdateTask} handleRemoveTask={handleRemoveTask}
                            handleStagePassRequirementChange={handleStagePassRequirementChange} isStageSelectable={isStageSelectable}
                            editingTask={editingTask} setEditingTask={setEditingTask} newTask={newTask} setNewTask={setNewTask}
                            checkStagePassPointsValidity={checkStagePassPointsValidity} getStageColor={getStageColor} getCategoryColor={getCategoryColor}
                            getVerificationIcon={getVerificationIcon} handleUseSuggestedTask={handleUseSuggestedTask}
                        />
                    )}
                    {step === 4 && (
                        <StepFourPreview
                            newQuest={newQuest} stageTotals={stageTotals} stagePassRequirements={stagePassRequirements}
                            selectedToken={selectedToken} network={network} isConnected={isConnected} isSaving={isSaving}
                            isSaveDisabled={isSaveDisabled} handleCreateQuest={handleCreateQuest} getStageColor={getStageColor}
                        />
                    )}
                </div>
                {/* Navigation Buttons */}
                <div className="flex justify-between pt-4 max-w-xl mx-auto">
                    <Button onClick={handleBack} disabled={step === 1} variant="outline">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    {step < maxSteps && (
                        <Button onClick={handleNext}>
                            Next Step <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    )}
                </div>
            </div>
        </>
    )
}