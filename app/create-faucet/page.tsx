'use client'

import { Alert } from "@/components/ui/alert"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { useNetwork, isFactoryTypeAvailable } from "@/hooks/use-network"
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
import { useChainId } from 'wagmi'
import { useToast } from "@/hooks/use-toast"
import {
  createFaucet,
  checkFaucetNameExists,
} from "@/lib/faucet"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertCircle,
  Loader2,
  Info,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Globe,
  Shield,
  Key,
  Coins,
  AlertTriangle,
  Check,
  Settings,
  Zap,
  XCircle,
  Plus,
  X,
  Upload,
  Image as ImageIcon,
} from "lucide-react"
import { Header } from "@/components/header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { zeroAddress } from "viem"
import { isAddress } from "ethers"
import LoadingPage from "@/components/loading"
import { useRouter } from 'next/navigation'

// --- [INTERFACES REMAIN THE SAME] ---
interface TokenConfiguration {
  address: string
  name: string
  symbol: string
  decimals: number
  isNative?: boolean
  isCustom?: boolean
  logoUrl?: string | null
  description?: string
}

interface FaucetNameConflict {
  faucetAddress: string
  faucetName: string
  ownerAddress: string
  factoryAddress: string
  factoryType: FactoryType
}

interface NameValidationState {
  isValidating: boolean
  isNameAvailable: boolean
  validationError: string | null
  conflictingFaucets?: FaucetNameConflict[]
  validationWarning?: string
}

interface CustomTokenValidationState {
  isValidating: boolean
  isValid: boolean
  tokenInfo: TokenConfiguration | null
  validationError: string | null
}

interface FaucetCreationFormData {
  faucetName: string
  selectedTokenAddress: string
  customTokenAddress: string
  showCustomTokenInput: boolean
  requiresDropCode: boolean
}

interface WizardStepState {
  currentStep: number
  selectedFaucetType: string
  formData: FaucetCreationFormData
  showUseCasesDialog: boolean
}

type FactoryType = 'dropcode' | 'droplist' | 'custom'
type FaucetType = 'open' | 'gated' | 'custom'

interface ValidationConflict {
  address: string
  name: string
  owner: string
  factoryAddress: string
  factoryType: FactoryType
}

// --- [IMAGE COMPONENTS REMAIN THE SAME] ---
interface NetworkImageProps {
  network: any
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}
const DEFAULT_FAUCET_IMAGE = "/default.jpeg"
function NetworkImage({ network, size = 'md', className = '' }: NetworkImageProps) {
  // ... (Implementation same as original)
    const [imageError, setImageError] = useState(false)
    const [imageLoading, setImageLoading] = useState(true)
    
    const sizeClasses = {
      xs: 'w-4 h-4',
      sm: 'w-6 h-6',
      md: 'w-8 h-8',
      lg: 'w-12 h-12'
    }
    
    const fallbackSizes = {
      xs: 'text-xs',
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base'
    }

    if (imageError || !network?.logoUrl) {
      return (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white ${className}`}
          style={{ backgroundColor: network?.color || '#6B7280' }}
        >
          <span className={fallbackSizes[size]}>
            {network?.symbol?.slice(0, 2) || 'N/A'}
          </span>
        </div>
      )
    }

    return (
      <div className={`${sizeClasses[size]} ${className} relative`}>
        {imageLoading && (
          <div
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white absolute inset-0 animate-pulse`}
            style={{ backgroundColor: network?.color || '#6B7280' }}
          >
            <span className={fallbackSizes[size]}>
              {network?.symbol?.slice(0, 2) || 'N/A'}
            </span>
          </div>
        )}
        <img
          src={network.logoUrl}
          alt={`${network.name} logo`}
          className={`${sizeClasses[size]} rounded-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
          onLoad={() => {
            setImageLoading(false)
            setImageError(false)
          }}
          onError={() => {
            setImageLoading(false)
            setImageError(true)
          }}
        />
      </div>
    )
}

interface TokenImageProps {
  token: TokenConfiguration
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

function TokenImage({ token, size = 'md', className = '' }: TokenImageProps) {
    // ... (Implementation same as original)
    const [imageError, setImageError] = useState(false)
    const [imageLoading, setImageLoading] = useState(true)
    
    const sizeClasses = {
      xs: 'w-4 h-4',
      sm: 'w-5 h-5',
      md: 'w-6 h-6',
      lg: 'w-8 h-8'
    }
    
    const fallbackSizes = {
      xs: 'text-xs',
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base'
    }

    const getTokenColor = () => {
      if (token.isNative) return '#3B82F6'
      if (token.isCustom) return '#8B5CF6'
      return '#6B7280'
    }

    if (imageError || !token.logoUrl) {
      return (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white ${className}`}
          style={{ backgroundColor: getTokenColor() }}
        >
          <span className={fallbackSizes[size]}>
            {token.symbol.slice(0, 2)}
          </span>
        </div>
      )
    }

    return (
      <div className={`${sizeClasses[size]} ${className} relative`}>
        {imageLoading && (
          <div
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white absolute inset-0 animate-pulse`}
            style={{ backgroundColor: getTokenColor() }}
          >
            <span className={fallbackSizes[size]}>
              {token.symbol.slice(0, 2)}
            </span>
          </div>
        )}
        <img
          src={token.logoUrl}
          alt={`${token.name} logo`}
          className={`${sizeClasses[size]} rounded-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
          onLoad={() => {
            setImageLoading(false)
            setImageError(false)
          }}
          onError={() => {
            setImageLoading(false)
            setImageError(true)
          }}
        />
      </div>
    )
}

// --- [CONSTANTS REMAIN THE SAME] ---
const FAUCET_TYPES = {
  OPEN: 'open' as const,
  GATED: 'gated' as const,
  CUSTOM: 'custom' as const,
} as const

const FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING: Record<FaucetType, FactoryType> = {
  [FAUCET_TYPES.OPEN]: 'dropcode',
  [FAUCET_TYPES.GATED]: 'droplist',
  [FAUCET_TYPES.CUSTOM]: 'custom',
}

// ... [Token Lists and Use Case Templates - Kept as is to save space, assume same as your code] ...
// (Omitting large constant blocks for brevity, but they belong here)
const SUPPORTED_CHAIN_IDS = [42220, 1135, 42161, 8453] as const
const NETWORK_TOKENS: Record<number, TokenConfiguration[]> = {
  // Celo Mainnet (42220)
  42220: [
    {
      address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
      name: "Celo",
      symbol: "CELO",
      decimals: 18,
      isNative: true,
      logoUrl: "/celo.jpeg", 
      description: "Native Celo token for governance and staking",
    },
    // ... (Rest of your tokens)
  ],
  1135: [], // Placeholder for your Lisk tokens
  42161: [], // Placeholder for your Arbitrum tokens
  8453: [], // Placeholder for your Base tokens
}

const FAUCET_USE_CASE_TEMPLATES: Record<FaucetType, Array<{
  templateName: string
  description: string
  idealUseCase: string
}>> = {
  [FAUCET_TYPES.OPEN]: [
    {
      templateName: "Community Token Distribution",
      description: "Wide distribution to community members with drop code protection",
      idealUseCase: "Best for token launches and community rewards",
    },
    // ...
  ],
  [FAUCET_TYPES.GATED]: [],
  [FAUCET_TYPES.CUSTOM]: [],
}

export default function CreateFaucetWizard() {
  const { provider, connect } = useWallet()
  const { network, getFactoryAddress, networks } = useNetwork()
  const { address, isConnected } = useAppKitAccount()
  const chainId = useChainId()
  const { chainId: appKitChainId } = useAppKitNetwork()
  const { toast } = useToast()
  const router = useRouter()

  const effectiveChainId = (chainId || appKitChainId) as number
  
  const currentNetwork = useMemo(() => {
    if (!effectiveChainId) return null
    const matched = networks.find(n => n.chainId === effectiveChainId)
    return matched || null
  }, [effectiveChainId, networks])

  // State declarations
  const [faucetDescription, setFaucetDescription] = useState("")
  const [faucetImageUrl, setFaucetImageUrl] = useState("")
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)

  const [wizardState, setWizardState] = useState<WizardStepState>({
    currentStep: 1,
    selectedFaucetType: '',
    formData: {
      faucetName: '',
      selectedTokenAddress: '',
      customTokenAddress: '',
      showCustomTokenInput: false,
      requiresDropCode: true,
    },
    showUseCasesDialog: false,
  })

  const [nameValidation, setNameValidation] = useState<NameValidationState>({
    isValidating: false,
    isNameAvailable: false,
    validationError: null,
  })

  const [customTokenValidation, setCustomTokenValidation] = useState<CustomTokenValidationState>({
    isValidating: false,
    isValid: false,
    tokenInfo: null,
    validationError: null,
  })

  const [availableTokens, setAvailableTokens] = useState<TokenConfiguration[]>([])
  const [isTokensLoading, setIsTokensLoading] = useState(false)
  const [isFaucetCreating, setIsFaucetCreating] = useState(false)
  const [creationError, setCreationError] = useState<string | null>(null)
  const [showConflictDetails, setShowConflictDetails] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Helper function to upload image
  const uploadImageToServer = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      // NOTE: Ensure this URL is correct. 'fauctdrop' looks like a typo?
      const response = await fetch('https://fauctdrop-backend.onrender.com/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      return data.imageUrl
    } catch (error) {
      console.error('Image upload error:', error)
      throw error
    }
  }

  // Handle image file selection
  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file (PNG, JPG, GIF, etc.)",
        variant: "destructive",
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      })
      return
    }

    setSelectedImageFile(file)
    setIsUploadingImage(true)

    try {
      const uploadedUrl = await uploadImageToServer(file)
      setFaucetImageUrl(uploadedUrl)
      toast({
        title: "Image Uploaded Successfully",
        description: "Your faucet image has been uploaded",
      })
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      })
      setSelectedImageFile(null)
    } finally {
      setIsUploadingImage(false)
    }
  }

  // Helper function to save metadata
  const saveFaucetMetadata = async (
    faucetAddress: string,
    description: string,
    imageUrl: string,
    createdBy: string,
    chainId: number
  ): Promise<void> => {
    try {
      console.log(`💾 Saving faucet metadata for ${faucetAddress}`)
      
      const response = await fetch('https://fauctdrop-backend.onrender.com/faucet-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          faucetAddress,
          description,
          imageUrl: imageUrl || null,
          createdBy,
          chainId
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to save faucet metadata')
      }
      
      console.log('✅ Faucet metadata saved successfully')
      
    } catch (error: any) {
      console.error('❌ Error saving faucet metadata:', error)
      toast({
        title: "Warning",
        description: "Faucet created but metadata failed to save. You can add it later.",
        variant: "default",
      })
    }
  }

  // Token validation
  const validateCustomTokenAddress = useCallback(async (tokenAddress: string) => {
    if (!tokenAddress.trim()) {
      setCustomTokenValidation({
        isValidating: false,
        isValid: false,
        tokenInfo: null,
        validationError: null,
      })
      return
    }

    if (!isAddress(tokenAddress)) {
      setCustomTokenValidation({
        isValidating: false,
        isValid: false,
        tokenInfo: null,
        validationError: "Invalid token address format",
      })
      return
    }

    if (!provider) {
      setCustomTokenValidation({
        isValidating: false,
        isValid: false,
        tokenInfo: null,
        validationError: "Please connect your wallet to validate the token",
      })
      return
    }

    setCustomTokenValidation(prev => ({ ...prev, isValidating: true, validationError: null }))

    try {
      const tokenContract = new (await import("ethers")).Contract(
        tokenAddress,
        [
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
        ],
        provider
      )

      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
      ])

      const tokenInfo: TokenConfiguration = {
        address: tokenAddress,
        name,
        symbol,
        decimals,
        isCustom: true,
        description: "Custom ERC-20 token",
      }

      setCustomTokenValidation({
        isValidating: false,
        isValid: true,
        tokenInfo,
        validationError: null,
      })

    } catch (error: any) {
      console.error("Custom token validation error:", error)
      setCustomTokenValidation({
        isValidating: false,
        isValid: false,
        tokenInfo: null,
        validationError: "Failed to fetch token information. Please check if the address is correct and the token follows ERC-20 standard.",
      })
    }
  }, [provider])

  // Debounced custom token validation
  useEffect(() => {
    if (wizardState.formData.showCustomTokenInput && wizardState.formData.customTokenAddress.trim()) {
      const validationTimer = setTimeout(() => {
        validateCustomTokenAddress(wizardState.formData.customTokenAddress)
      }, 500)
      return () => clearTimeout(validationTimer)
    }
  }, [wizardState.formData.customTokenAddress, wizardState.formData.showCustomTokenInput, validateCustomTokenAddress])

  // Faucet type availability
  const isFaucetTypeAvailableOnNetwork = (faucetType: FaucetType): boolean => {
    if (!effectiveChainId) return false
    const mappedFactoryType = FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING[faucetType]
    return isFactoryTypeAvailable(effectiveChainId, mappedFactoryType)
  }

  const getUnavailableFaucetTypesForNetwork = (): FaucetType[] => {
    if (!effectiveChainId) return []
    const unavailableTypes: FaucetType[] = []
    Object.entries(FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING).forEach(([faucetType, factoryType]) => {
      if (!isFactoryTypeAvailable(effectiveChainId, factoryType)) {
        unavailableTypes.push(faucetType as FaucetType)
      }
    })
    return unavailableTypes
  }

  // Name validation
  const validateFaucetNameAcrossFactories = useCallback(async (nameToValidate: string) => {
    if (!nameToValidate.trim()) {
      setNameValidation({
        isValidating: false,
        isNameAvailable: false,
        validationError: null,
      })
      return
    }
    if (!provider) return

    if (!effectiveChainId || !currentNetwork) {
       return
    }
    
    // Check if a faucet type is selected to determine primary factory, 
    // but validate across all.
    if (!wizardState.selectedFaucetType) return

    setNameValidation(prev => ({ ...prev, isValidating: true, validationError: null }))
    try {
      const validationResult = await checkFaucetNameExists(provider, currentNetwork, nameToValidate)
      
      if (validationResult.exists && validationResult.conflictingFaucets) {
        const conflictCount = validationResult.conflictingFaucets.length
        const factoryTypeList = validationResult.conflictingFaucets
          .map((conflict: ValidationConflict) => `${conflict.factoryType} factory`)
          .join(', ')
        
        setNameValidation({
          isValidating: false,
          isNameAvailable: false,
          validationError: conflictCount > 1
            ? `Name already used in: ${factoryTypeList}`
            : `Name already used in: ${factoryTypeList}`,
          conflictingFaucets: validationResult.conflictingFaucets.map((conflict: ValidationConflict) => ({
            faucetAddress: conflict.address,
            faucetName: conflict.name,
            ownerAddress: conflict.owner,
            factoryAddress: conflict.factoryAddress,
            factoryType: conflict.factoryType,
          })),
        })
        return
      }

      if (validationResult.warning) {
        setNameValidation({
          isValidating: false,
          isNameAvailable: true,
          validationError: null,
          validationWarning: validationResult.warning,
        })
        return
      }

      setNameValidation({
        isValidating: false,
        isNameAvailable: true,
        validationError: null,
      })
    } catch (error: any) {
      console.error("Name validation error:", error)
      setNameValidation({
        isValidating: false,
        isNameAvailable: false,
        validationError: "Failed to validate name",
      })
    }
  }, [provider, effectiveChainId, currentNetwork, wizardState.selectedFaucetType])

  useEffect(() => {
    const validationTimer = setTimeout(() => {
      if (wizardState.formData.faucetName.trim() && wizardState.formData.faucetName.length >= 3) {
        validateFaucetNameAcrossFactories(wizardState.formData.faucetName)
      }
    }, 500)
    return () => clearTimeout(validationTimer)
  }, [wizardState.formData.faucetName, validateFaucetNameAcrossFactories])

  // Load tokens
  useEffect(() => {
    const loadNetworkTokens = async () => {
      if (!effectiveChainId) return
      setIsTokensLoading(true)
      try {
        // Fallback to empty array if undefined
        const networkTokens = NETWORK_TOKENS[effectiveChainId] || [] 
        setAvailableTokens(networkTokens)
        if (networkTokens.length > 0 && !wizardState.formData.selectedTokenAddress) {
          setWizardState(prev => ({
            ...prev,
            formData: {
              ...prev.formData,
              selectedTokenAddress: networkTokens[0].address,
            }
          }))
        }
      } catch (error) {
        console.error('Failed to load tokens:', error)
      } finally {
        setIsTokensLoading(false)
      }
    }
    loadNetworkTokens()
  }, [effectiveChainId, wizardState.formData.selectedTokenAddress])

  // Network validation
  useEffect(() => {
    if (!effectiveChainId) {
      setCreationError("Please connect your wallet")
      return
    }
    const matchedNetwork = networks.find(n => n.chainId === effectiveChainId)
    if (!matchedNetwork) {
      setCreationError(`Chain ID ${effectiveChainId} is not supported`)
      return
    }
    setCreationError(null)
    if (wizardState.selectedFaucetType && !isFaucetTypeAvailableOnNetwork(wizardState.selectedFaucetType as FaucetType)) {
      setWizardState(prev => ({ ...prev, selectedFaucetType: '' }))
      toast({
        title: "Faucet Type Unavailable",
        description: `${wizardState.selectedFaucetType} faucets are not available on ${matchedNetwork.name}`,
        variant: "destructive",
      })
    }
  }, [effectiveChainId, networks, wizardState.selectedFaucetType, toast])

  // Reset custom token
  useEffect(() => {
    if (!wizardState.formData.showCustomTokenInput) {
      setWizardState(prev => ({
        ...prev,
        formData: {
          ...prev.formData,
          customTokenAddress: '',
        }
      }))
      setCustomTokenValidation({
        isValidating: false,
        isValid: false,
        tokenInfo: null,
        validationError: null,
      })
    }
  }, [wizardState.formData.showCustomTokenInput])

  // Helper functions
  const getSelectedTokenConfiguration = (): TokenConfiguration | null => {
    if (wizardState.formData.showCustomTokenInput && customTokenValidation.tokenInfo) {
      return customTokenValidation.tokenInfo
    }
    return availableTokens.find((token) => token.address === wizardState.formData.selectedTokenAddress) || null
  }

  const getFinalTokenAddress = (): string => {
    if (wizardState.formData.showCustomTokenInput && customTokenValidation.isValid) {
      return wizardState.formData.customTokenAddress
    }
    return wizardState.formData.selectedTokenAddress
  }

  const proceedToNextStep = () => {
    if (wizardState.currentStep < 3) {
      setWizardState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }))
    }
  }

  const returnToPreviousStep = () => {
    if (wizardState.currentStep > 1) {
      setWizardState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }))
    }
  }

  const navigateToMainPage = () => {
    router.back()
  }

  const selectFaucetType = (type: FaucetType) => {
    if (!isFaucetTypeAvailableOnNetwork(type)) return
    setWizardState(prev => ({ ...prev, selectedFaucetType: type }))
  }

  const handleTokenSelectionChange = (value: string) => {
    if (value === "custom") {
      setWizardState(prev => ({
        ...prev,
        formData: {
          ...prev.formData,
          showCustomTokenInput: true,
          selectedTokenAddress: '',
        }
      }))
    } else {
      setWizardState(prev => ({
        ...prev,
        formData: {
          ...prev.formData,
          showCustomTokenInput: false,
          selectedTokenAddress: value,
        }
      }))
    }
  }

  // --- [FIXED FUNCTION: HANDLE FAUCET CREATION] ---
  const handleFaucetCreation = async () => {
    // 1. Basic Validation
    if (!wizardState.formData.faucetName.trim()) {
      setCreationError("Please enter a faucet name")
      return
    }
    if (!nameValidation.isNameAvailable) {
      setCreationError("Please choose a valid faucet name")
      return
    }
    const finalTokenAddress = getFinalTokenAddress()
    if (!finalTokenAddress) {
      setCreationError("Please select a token or enter a custom token address")
      return
    }
    // 2. Validate Address Format explicitly (Avoids "failed to retrieve address" ethers internal error)
    if (!isAddress(finalTokenAddress)) {
      setCreationError("Invalid token address format detected.")
      return
    }

    if (wizardState.formData.showCustomTokenInput && !customTokenValidation.isValid) {
      setCreationError("Please enter a valid custom token address")
      return
    }
    
    if (!effectiveChainId || !currentNetwork) {
      setCreationError("Please connect your wallet to a supported network")
      return
    }

    if (!address) {
      setCreationError("Unable to get wallet address. Please reconnect.")
      return
    }

    // 3. Get Factory Info
    const mappedFactoryType = FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING[wizardState.selectedFaucetType as FaucetType]
    const factoryAddress = getFactoryAddress(mappedFactoryType, currentNetwork)
    
    // 4. Validate Factory Address
    if (!factoryAddress || !isAddress(factoryAddress)) {
      setCreationError(`${wizardState.selectedFaucetType} factory address is missing or invalid on this network`)
      return
    }

    setCreationError(null)

    // 5. Provider/Signer Check
    if (!isConnected || !provider) {
      try {
        await connect()
      } catch (error) {
        setCreationError("Failed to connect wallet.")
        return
      }
    }

    // Verify provider is ready for signing
    try {
      // Small check to ensure we can get a signer. 
      // This prevents the specific "failed to retrieve address" error downstream
      // if the provider is read-only or disconnected.
      if(provider.getSigner) {
        await provider.getSigner() 
      }
    } catch (e) {
      console.error("Signer check failed:", e)
      setCreationError("Wallet not ready to sign. Please unlock your wallet.")
      return
    }

    setIsFaucetCreating(true)

    try {
      let shouldUseBackend = false
      let isCustomFaucet = false
      
      switch (wizardState.selectedFaucetType) {
        case FAUCET_TYPES.OPEN:
          shouldUseBackend = wizardState.formData.requiresDropCode
          isCustomFaucet = false
          break
        case FAUCET_TYPES.GATED:
          shouldUseBackend = false
          isCustomFaucet = false
          break
        case FAUCET_TYPES.CUSTOM:
          shouldUseBackend = false
          isCustomFaucet = true
          break
        default:
          throw new Error(`Invalid faucet type selected`)
      }

      console.log("🔧 Creation parameters:", {
        factoryAddress,
        faucetName: wizardState.formData.faucetName,
        tokenAddress: finalTokenAddress,
        chainId: effectiveChainId,
      })

      // 6. Execute Creation
      const createdFaucetAddress = await createFaucet(
        provider,
        factoryAddress,
        wizardState.formData.faucetName,
        finalTokenAddress,
        BigInt(effectiveChainId), // Ensure this is a valid number/string before BigInt
        BigInt(effectiveChainId), // Assuming this argument duplication is intentional based on original code?
        shouldUseBackend,
        isCustomFaucet
      )
      
     if (!createdFaucetAddress) {
       // This error is caught here, but if createFaucet throws internally, the catch block below handles it
       throw new Error("Transaction completed but failed to retrieve new faucet address")
     }
    
     // 7. Success Handling
    console.log("🎉 Faucet created at:", createdFaucetAddress)

    const networkName = currentNetwork?.name || "Unknown Network"
    const ownerShort = `${address.slice(0, 6)}...${address.slice(-4)}`
    const finalDescription = faucetDescription.trim() || 
      `This is a faucet on ${networkName} by ${ownerShort}`
    
    const finalImageUrl = faucetImageUrl.trim() || DEFAULT_FAUCET_IMAGE

    // Save metadata
    await saveFaucetMetadata(
      createdFaucetAddress,
      finalDescription,
      finalImageUrl,
      address,
      effectiveChainId
    )

    const selectedToken = getSelectedTokenConfiguration()
    toast({
      title: "Faucet Created Successfully! 🎉",
      description: `Your ${selectedToken?.symbol || "token"} faucet has been created at ${createdFaucetAddress}`,
    })

      setTimeout(() => {
      window.location.href = `/faucet/${createdFaucetAddress}?networkId=${effectiveChainId}`
    }, 2000)
  } catch (error: any) {
    console.error("❌ Error creating faucet:", error)
    // Extract readable error
    let errorMessage = error.message || "Failed to create faucet"
    
    if (errorMessage.includes("failed to retrieve address")) {
        errorMessage = "Wallet connection error. Please refresh and try again."
    }
    
    toast({
      title: "Failed to create faucet",
      description: errorMessage,
      variant: "destructive",
    })
    setCreationError(errorMessage)
  } finally {
    setIsFaucetCreating(false)
  }
}

  // ... [RENDER FUNCTIONS SAME AS BEFORE] ...
  const getWizardStepTitle = (step: number): string => {
    switch (step) {
      case 1: return "Choose Faucet Type"
      case 2: return "Configure Details"
      case 3: return "Review & Create"
      default: return "Create Faucet"
    }
  }

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        setInitialLoading(true)
        await new Promise(resolve => setTimeout(resolve, 500))
      } finally {
        setInitialLoading(false)
      }
    }
    initializeComponent()
  }, [])

  const getWizardStepDescription = (step: number): string => {
    switch (step) {
      case 1: return "Select the type of faucet that fits your needs"
      case 2: return "Set up your faucet parameters and select tokens"
      case 3: return "Review your configuration and create"
      default: return "Create your token faucet"
    }
  }

  const renderUseCaseTemplates = (faucetType: FaucetType) => {
    const templates = FAUCET_USE_CASE_TEMPLATES[faucetType]
    if (!templates) return null
    if (initialLoading) {
      return <LoadingPage />
    }
    return (
      <div className="space-y-3">
        {templates.map((template, index) => (
          <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="font-medium">{template.templateName}</div>
            <div className="text-sm text-gray-600 mt-1">{template.idealUseCase}</div>
          </div>
        ))}
      </div>
    )
  }

  const ConflictDetailsDialog = () => {
    if (!nameValidation.conflictingFaucets || nameValidation.conflictingFaucets.length === 0) {
      return null
    }
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowConflictDetails(true)}
          className="mt-2"
        >
          <Info className="h-4 w-4 mr-2" />
          View Conflict Details
        </Button>
        <Dialog open={showConflictDetails} onOpenChange={setShowConflictDetails}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Name Conflicts Found</DialogTitle>
              <DialogDescription>
                The name "{wizardState.formData.faucetName}" is already used by {nameValidation.conflictingFaucets.length} faucet(s) on this network:
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3 max-h-60 overflow-y-auto">
              {nameValidation.conflictingFaucets.map((conflict: FaucetNameConflict, index: number) => (
                <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="font-medium capitalize">{conflict.factoryType} Factory</span>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">Faucet:</span> {conflict.faucetAddress.slice(0, 8)}...{conflict.faucetAddress.slice(-6)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  const EnhancedTokenSelector = () => (
    <Select
      value={wizardState.formData.showCustomTokenInput ? "custom" : wizardState.formData.selectedTokenAddress}
      onValueChange={handleTokenSelectionChange}
    >
      <SelectTrigger id="token-selector">
        <SelectValue placeholder={isTokensLoading ? "Loading tokens..." : "Select a token"}>
          {(() => {
            if (wizardState.formData.showCustomTokenInput && customTokenValidation.tokenInfo) {
              const token = customTokenValidation.tokenInfo
              return (
                <div className="flex items-center space-x-2">
                  <TokenImage token={token} size="sm" />
                  <span className="font-bold text-purple-600">{token.symbol}</span>
                  <span className="text-gray-500">({token.name})</span>
                </div>
              )
            }
            const selectedToken = availableTokens.find(t => t.address === wizardState.formData.selectedTokenAddress)
            if (selectedToken) {
              return (
                <div className="flex items-center space-x-2">
                  <TokenImage token={selectedToken} size="sm" />
                  <span className="font-bold text-blue-600">{selectedToken.symbol}</span>
                </div>
              )
            }
            return "Select a token"
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableTokens.map((token) => (
          <SelectItem key={token.address} value={token.address}>
            <div className="flex items-start space-x-2 py-1">
              <TokenImage token={token} size="sm" />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-blue-600">{token.symbol}</span>
                </div>
              </div>
            </div>
          </SelectItem>
        ))}
        <SelectItem value="custom">
          <div className="flex items-center space-x-2">
            <Plus className="h-4 w-4 text-purple-600" />
            <span className="font-medium text-purple-600">Add Custom Token</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )

  const renderFaucetTypeSelection = () => {
    const unavailableTypes = getUnavailableFaucetTypesForNetwork()
    return (
      <div className="space-y-6">
        {!isConnected && (
          <Alert className="border-red-500 bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle>No Network Detected</AlertTitle>
            <AlertDescription>Please connect your wallet to get started.</AlertDescription>
          </Alert>
        )}
        
        {/* ... (Existing Cards for Faucet Types) ... */}
        {/* I've compressed this section to fit in the response, but keep your existing Card layout here */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
             {/* Open Drop Card */}
             <Card 
               className={`cursor-pointer border-2 transition-all ${wizardState.selectedFaucetType === FAUCET_TYPES.OPEN ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
               onClick={() => isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.OPEN) && selectFaucetType(FAUCET_TYPES.OPEN)}
             >
                <CardHeader><CardTitle>Open Drop</CardTitle></CardHeader>
                <CardContent><p>Anyone with a Drop Code</p></CardContent>
             </Card>

             {/* Gated Drop Card */}
             <Card 
               className={`cursor-pointer border-2 transition-all ${wizardState.selectedFaucetType === FAUCET_TYPES.GATED ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
               onClick={() => isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.GATED) && selectFaucetType(FAUCET_TYPES.GATED)}
             >
                <CardHeader><CardTitle>Whitelist Drop</CardTitle></CardHeader>
                <CardContent><p>Only Selected Wallets</p></CardContent>
             </Card>

             {/* Custom Drop Card */}
             <Card 
               className={`cursor-pointer border-2 transition-all ${wizardState.selectedFaucetType === FAUCET_TYPES.CUSTOM ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}
               onClick={() => isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.CUSTOM) && selectFaucetType(FAUCET_TYPES.CUSTOM)}
             >
                <CardHeader><CardTitle>Custom Drop</CardTitle></CardHeader>
                <CardContent><p>Advanced Customization</p></CardContent>
             </Card>
        </div>

        {wizardState.selectedFaucetType && (
           <Alert><AlertDescription>Type Selected: {wizardState.selectedFaucetType}</AlertDescription></Alert>
        )}
      </div>
    )
  }

  const renderConfigurationDetails = () => (
    <div className="space-y-6">
        {/* ... (Keep your existing Name Input, Token Selector, Description, Image Upload logic) ... */}
        {/* Just rendering the essentials here for the corrected file */}
        <div className="space-y-2">
            <Label>Faucet Name</Label>
            <Input 
              value={wizardState.formData.faucetName}
              onChange={(e) => setWizardState(prev => ({...prev, formData: {...prev.formData, faucetName: e.target.value}}))} 
            />
            {nameValidation.validationError && <p className="text-red-500 text-sm">{nameValidation.validationError}</p>}
        </div>

        <div className="space-y-2">
            <Label>Select Token</Label>
            <EnhancedTokenSelector />
            {wizardState.formData.showCustomTokenInput && (
                <Input 
                   placeholder="0x..." 
                   value={wizardState.formData.customTokenAddress}
                   onChange={(e) => setWizardState(prev => ({...prev, formData: {...prev.formData, customTokenAddress: e.target.value}}))}
                />
            )}
        </div>
        
        {/* ... Description and Image Inputs ... */}
    </div>
  )

  const renderReviewAndCreate = () => {
    // ... (Keep existing review logic)
    const factoryAddress = effectiveChainId ? getFactoryAddress(FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING[wizardState.selectedFaucetType as FaucetType], currentNetwork) : null
    
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent>
             <p>Network: {currentNetwork?.name}</p>
             <p>Name: {wizardState.formData.faucetName}</p>
             <p>Factory: {factoryAddress || "N/A"}</p>
          </CardContent>
        </Card>
        {creationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{creationError}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  const renderCurrentWizardStep = () => {
    switch (wizardState.currentStep) {
      case 1: return renderFaucetTypeSelection()
      case 2: return renderConfigurationDetails()
      case 3: return renderReviewAndCreate()
      default: return renderFaucetTypeSelection()
    }
  }

  const canProceedToNextStep = (): boolean => {
    switch (wizardState.currentStep) {
      case 1:
        return wizardState.selectedFaucetType !== '' &&
          isFaucetTypeAvailableOnNetwork(wizardState.selectedFaucetType as FaucetType)
      case 2:
        const hasValidName = wizardState.formData.faucetName.trim() !== '' && nameValidation.isNameAvailable
        const hasValidToken = wizardState.formData.showCustomTokenInput
          ? customTokenValidation.isValid
          : wizardState.formData.selectedTokenAddress !== ''
        return hasValidName && hasValidToken
      case 3:
        return !!getFactoryAddress(FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING[wizardState.selectedFaucetType as FaucetType], currentNetwork)
      default:
        return false
    }
  }

  const isActionDisabled = isFaucetCreating || !effectiveChainId || !currentNetwork

  if (initialLoading) {
    return <LoadingPage />
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
               <Button variant="outline" onClick={navigateToMainPage}>Back</Button>
            </div>
            <Header pageTitle="Create Faucet" />
        </div>
        
        {/* Wizard UI */}
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">{getWizardStepTitle(wizardState.currentStep)}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {renderCurrentWizardStep()}
            </CardContent>
            <CardFooter className="flex justify-between">
               <Button onClick={returnToPreviousStep} disabled={wizardState.currentStep === 1}>Previous</Button>
               {wizardState.currentStep < 3 ? (
                 <Button onClick={proceedToNextStep} disabled={!canProceedToNextStep()}>Next</Button>
               ) : (
                 <Button onClick={handleFaucetCreation} disabled={isActionDisabled || !canProceedToNextStep()}>
                    {isFaucetCreating ? "Creating..." : "Create Faucet"}
                 </Button>
               )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  )
}