import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  Coins,
  Users,
  FileUp,
  RotateCcw,
  History,
  Edit,
  Trash2,
  Key,
  Copy,
  Clock,
  ExternalLink,
  Download,
  Eye,
  Link,
  CheckCircle,
  Share2,
  Zap,
  Menu,
} from "lucide-react";
import { formatUnits, parseUnits, type BrowserProvider } from "ethers";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomClaimUploader } from "@/components/customClaim";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import FaucetUserView from "./FaucetUserView";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  setWhitelistBatch,
  setCustomClaimAmountsBatch,
  resetAllClaims,
  fundFaucet,
  withdrawTokens,
  setClaimParameters,
  addAdmin,
  removeAdmin,
  getFaucetTransactionHistory,
  updateFaucetName,
  deleteFaucet,
} from "@/lib/faucet";
import { retrieveSecretCode } from "@/lib/backend-service";

type FaucetType = "dropcode" | "droplist" | "custom";
const FACTORY_OWNER_ADDRESS = "0x9fBC2A0de6e5C5Fd96e8D11541608f5F328C0785";

interface SocialMediaLink {
  platform: string;
  url: string;
  handle: string;
  action: string;
}

interface FaucetAdminViewProps {
  faucetAddress: string;
  faucetDetails: any;
  faucetType: FaucetType | null;
  tokenSymbol: string;
  tokenDecimals: number;
  selectedNetwork: any;
  adminList: string[];
  isOwner: boolean;
  backendMode: boolean;
  canAccessAdminControls: boolean;
  loadFaucetDetails: () => Promise<void>;
  checkNetwork: (skipToast?: boolean) => boolean;
  dynamicTasks: SocialMediaLink[];
  newSocialLinks: SocialMediaLink[];
  setNewSocialLinks: React.Dispatch<React.SetStateAction<SocialMediaLink[]>>;
  customXPostTemplate: string;
  setCustomXPostTemplate: React.Dispatch<React.SetStateAction<string>>;
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  transactions: any[];
  address: string | null;
  chainId: number | null;
  provider: any;
  handleGoBack: () => void;
  router: any;
  faucetMetadata: {
    description?: string;
    imageUrl?: string;
  };
}

const getActionText = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case "telegram":
      return "Join";
    case "discord":
      return "Join";
    case "𝕏":
    case "x":
      return "Follow";
    default:
      return "Follow";
  }
};

const getPlatformIcon = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case "telegram":
      return "";
    case "discord":
      return "";
    case "𝕏":
    case "x":
      return "𝕏";
    default:
      return "";
  }
};

const getCurrentDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const FaucetAdminView: React.FC<FaucetAdminViewProps> = ({
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
  faucetMetadata,
}) => {
  const { toast } = useToast();

  // --- UI States ---
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("fund");
  const [showFundPopup, setShowFundPopup] = useState(false);
  const [showEditNameDialog, setShowEditNameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddAdminDialog, setShowAddAdminDialog] = useState(false);
  const [showCurrentSecretDialog, setShowCurrentSecretDialog] = useState(false);
  const [showNewCodeDialog, setShowNewCodeDialog] = useState(false);

  // --- Data/Form States ---
  const [fundAmount, setFundAmount] = useState("");
  const [adjustedFundAmount, setAdjustedFundAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [claimAmount, setClaimAmount] = useState(
    faucetDetails?.claimAmount
      ? formatUnits(faucetDetails.claimAmount, tokenDecimals)
      : "0"
  );
  const [startTime, setStartTime] = useState(
    faucetDetails?.startTime
      ? new Date(Number(faucetDetails.startTime) * 1000)
          .toISOString()
          .slice(0, 16)
      : ""
  );
  const [endTime, setEndTime] = useState(
    faucetDetails?.endTime
      ? new Date(Number(faucetDetails.endTime) * 1000)
          .toISOString()
          .slice(0, 16)
      : ""
  );
  const [startTimeError, setStartTimeError] = useState("");
  const [whitelistAddresses, setWhitelistAddresses] = useState("");
  const [isWhitelistEnabled, setIsWhitelistEnabled] = useState(true);
  const [newFaucetName, setNewFaucetName] = useState(
    faucetDetails?.name || ""
  );
  const [newAdminAddress, setNewAdminAddress] = useState("");
  const [currentSecretCode, setCurrentSecretCode] = useState("");
  const [newlyGeneratedCode, setNewlyGeneratedCode] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddingAdmin, setIsAddingAdmin] = useState(true);

  // --- Loading States ---
  const [isFunding, setIsFunding] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isUpdatingParameters, setIsUpdatingParameters] = useState(false);
  const [isUpdatingWhitelist, setIsUpdatingWhitelist] = useState(false);
  const [isResettingClaims, setIsResettingClaims] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isDeletingFaucet, setIsDeletingFaucet] = useState(false);
  const [isManagingAdmin, setIsManagingAdmin] = useState(false);
  const [isRetrievingSecret, setIsRetrievingSecret] = useState(false);
  const [isGeneratingNewCode, setIsGeneratingNewCode] = useState(false);

  // --- Derived State Helpers ---
  const shouldShowWhitelistTab = faucetType === "droplist";
  const shouldShowCustomTab = faucetType === "custom";
  const shouldShowSecretCodeButton = faucetType === "dropcode" && backendMode;
  const isOwnerOrAdmin =
    isOwner ||
    adminList.some((a) => address && a.toLowerCase() === address.toLowerCase());

  const calculateFee = (amount: string) => {
    try {
      const parsedAmount = parseUnits(amount, tokenDecimals);
      const fee = (parsedAmount * BigInt(3)) / BigInt(100);
      const netAmount = parsedAmount - fee;
      const recommendedInput = (parsedAmount * BigInt(100)) / BigInt(97);
      const recommendedInputStr = Number(
        formatUnits(recommendedInput, tokenDecimals)
      ).toFixed(3);
      return {
        fee: formatUnits(fee, tokenDecimals),
        netAmount: formatUnits(netAmount, tokenDecimals),
        recommendedInput: recommendedInputStr,
      };
    } catch {
      return { fee: "0", netAmount: "0", recommendedInput: "0" };
    }
  };
  const { fee, netAmount, recommendedInput } = calculateFee(fundAmount);

  const validateStartTime = (value: string): boolean => {
    if (!value) {
      setStartTimeError("");
      return false;
    }
    const now = new Date();
    const selectedTime = new Date(value);
    if (selectedTime <= now) {
      setStartTimeError("Start time must be ahead of current time ");
      return false;
    } else {
      setStartTimeError("");
      return true;
    }
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStartTime(value);
    validateStartTime(value);
  };

  const loadTransactionHistory = useCallback(async () => {
    if (!selectedNetwork || !provider) return;
    try {
      const txs = await getFaucetTransactionHistory(
        provider as BrowserProvider,
        faucetAddress,
        selectedNetwork,
        faucetType || undefined
      );
      const sortedTxs = txs.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(sortedTxs);
    } catch (error: any) {
      console.error("Error loading Activity Log:", error);
      toast({
        title: "Failed to load Activity Log",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    }
  }, [
    provider,
    faucetAddress,
    selectedNetwork,
    faucetType,
    setTransactions,
    toast,
  ]);

  useEffect(() => {
    if (activeTab === "history" && selectedNetwork) {
      loadTransactionHistory();
    }
  }, [activeTab, selectedNetwork, loadTransactionHistory]);

  useEffect(() => {
    if (faucetDetails) {
      if (faucetType !== "custom" && faucetDetails.claimAmount) {
        setClaimAmount(formatUnits(faucetDetails.claimAmount, tokenDecimals));
      }
      if (faucetDetails.startTime) {
        setStartTime(
          new Date(Number(faucetDetails.startTime) * 1000)
            .toISOString()
            .slice(0, 16)
        );
      }
      if (faucetDetails.endTime) {
        setEndTime(
          new Date(Number(faucetDetails.endTime) * 1000)
            .toISOString()
            .slice(0, 16)
        );
      }
      if (faucetDetails.name) {
        setNewFaucetName(faucetDetails.name);
      }
    }
  }, [faucetDetails, faucetType, tokenDecimals]);

  // --- Handlers ---

  const saveSocialMediaTasks = async (tasksToSend: any[]): Promise<boolean> => {
    if (!address || !chainId) return false;
    try {
      console.log(
        `Saving ${tasksToSend.length} tasks via dedicated backend endpoint.`
      );
      const response = await fetch(
        "http://127.0.0.1:8000/add-faucet-tasks",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            faucetAddress,
            tasks: tasksToSend,
            userAddress: address,
            chainId: Number(chainId),
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save social media tasks.");
      }
      toast({
        title: "Tasks Saved",
        description: "Social media tasks updated successfully.",
      });
      setNewSocialLinks([]);
      await loadFaucetDetails();
      return true;
    } catch (error: any) {
      console.error("Error saving social media tasks:", error);
      toast({
        title: "Task Save Failed",
        description: error.message || "Could not save tasks to backend.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleUpdateFaucetName = async (): Promise<void> => {
    if (
      !address ||
      !provider ||
      !newFaucetName.trim() ||
      !chainId ||
      !checkNetwork()
    )
      return;
    try {
      setIsUpdatingName(true);
      await updateFaucetName(
        provider as BrowserProvider,
        faucetAddress,
        newFaucetName,
        BigInt(chainId),
        BigInt(Number(selectedNetwork.chainId)),
        faucetType || undefined
      );
      toast({
        title: "Faucet name updated",
        description: `Faucet name has been updated to ${newFaucetName}`,
      });
      setShowEditNameDialog(false);
      await loadFaucetDetails();
    } catch (error: any) {
      console.error("Error updating faucet name:", error);
      toast({
        title: "Failed to update faucet name",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleDeleteFaucet = async (): Promise<void> => {
    if (!address || !provider || !chainId || !checkNetwork()) return;
    try {
      setIsDeletingFaucet(true);
      await deleteFaucet(
        provider as BrowserProvider,
        faucetAddress,
        BigInt(chainId),
        BigInt(Number(selectedNetwork.chainId)),
        faucetType || undefined
      );
      toast({
        title: "Faucet deleted",
        description: "Faucet has been successfully deleted",
      });
      setShowDeleteDialog(false);
      router.push("/");
    } catch (error: any) {
      console.error("Error deleting faucet:", error);
      toast({
        title: "Failed to delete faucet",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeletingFaucet(false);
    }
  };

  const handleFund = async (): Promise<void> => {
    if (!checkNetwork()) return;
    setAdjustedFundAmount(fundAmount);
    setShowFundPopup(true);
  };

  const confirmFund = async (): Promise<void> => {
    if (!address || !provider || !adjustedFundAmount || !chainId) return;
    try {
      setIsFunding(true);
      const amount = parseUnits(adjustedFundAmount, tokenDecimals);
      await fundFaucet(
        provider as BrowserProvider,
        faucetAddress,
        amount,
        faucetDetails.isEther,
        BigInt(chainId),
        BigInt(Number(selectedNetwork.chainId)),
        faucetType || undefined
      );
      toast({
        title: "Faucet funded successfully",
        description: `You added ${formatUnits(
          amount,
          tokenDecimals
        )} ${tokenSymbol} to the faucet (minus 3% platform fee)`,
      });
      setFundAmount("");
      setShowFundPopup(false);
      await loadFaucetDetails();
      await loadTransactionHistory();
    } catch (error: any) {
      console.error("Error funding faucet:", error);
      toast({
        title: "Failed to fund faucet",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsFunding(false);
    }
  };

  const handleWithdraw = async (): Promise<void> => {
    if (
      !address ||
      !provider ||
      !withdrawAmount ||
      !chainId ||
      !checkNetwork()
    )
      return;
    try {
      setIsWithdrawing(true);
      const amount = parseUnits(withdrawAmount, tokenDecimals);
      await withdrawTokens(
        provider as BrowserProvider,
        faucetAddress,
        amount,
        BigInt(chainId),
        BigInt(Number(selectedNetwork.chainId)),
        faucetType || undefined
      );
      toast({
        title: "Tokens withdrawn successfully",
        description: `You withdrew ${withdrawAmount} ${tokenSymbol}.`,
      });
      setWithdrawAmount("");
      await loadFaucetDetails();
      await loadTransactionHistory();
    } catch (error: any) {
      console.error("Error withdrawing tokens:", error);
      toast({
        title: "Failed to withdraw tokens",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleUpdateClaimParameters = async (): Promise<void> => {
    if (!address || !provider || !chainId || !checkNetwork()) return;
    const hasTaskChanges = newSocialLinks.length > 0;
    const currentClaimAmountStr =
      faucetType !== "custom"
        ? formatUnits(faucetDetails.claimAmount, tokenDecimals)
        : "0";
    const currentStartTimeStr = faucetDetails.startTime
      ? new Date(Number(faucetDetails.startTime) * 1000)
          .toISOString()
          .slice(0, 16)
      : "";
    const currentEndTimeStr = faucetDetails.endTime
      ? new Date(Number(faucetDetails.endTime) * 1000)
          .toISOString()
          .slice(0, 16)
      : "";
    const isClaimAmountChanged =
      faucetType !== "custom" && claimAmount !== currentClaimAmountStr;
    const isStartTimeChanged = startTime !== currentStartTimeStr;
    const isEndTimeChanged = endTime !== currentEndTimeStr;
    const hasBlockchainChanges =
      isClaimAmountChanged || isStartTimeChanged || isEndTimeChanged;

    if (!hasTaskChanges && !hasBlockchainChanges) {
      toast({
        title: "No Changes",
        description: "No parameters or tasks were modified.",
        variant: "default",
      });
      return;
    }

    if (!hasBlockchainChanges && hasTaskChanges) {
      const tasksToSend = newSocialLinks
        .filter((link) => link.url.trim() && link.handle.trim())
        .map((link) => ({
          title: `${
            link.action.charAt(0).toUpperCase() + link.action.slice(1)
          } ${link.handle}`,
          description: `${
            link.action.charAt(0).toUpperCase() + link.action.slice(1)
          } our ${link.platform} account: ${link.handle}`,
          url: link.url.trim(),
          required: true,
          platform: link.platform,
          handle: link.handle,
          action: link.action,
        }));
      await saveSocialMediaTasks(tasksToSend);
      return;
    }

    if (faucetType !== "custom" && !claimAmount) {
      toast({
        title: "Invalid Input",
        description: "Please fill in the drop amount",
        variant: "destructive",
      });
      return;
    }
    if (!startTime || !endTime) {
      toast({
        title: "Invalid Input",
        description: "Please fill in the start and end times",
        variant: "destructive",
      });
      return;
    }
    if (startTimeError) {
      toast({
        title: "Invalid Start Time",
        description: startTimeError,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUpdatingParameters(true);
      const claimAmountBN =
        faucetType === "custom"
          ? BigInt(0)
          : parseUnits(claimAmount, tokenDecimals);
      const startTimestamp = Math.floor(new Date(startTime).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);

      if (hasTaskChanges) {
        const tasksToSend = newSocialLinks
          .filter((link) => link.url.trim() && link.handle.trim())
          .map((link) => ({
            title: `${
              link.action.charAt(0).toUpperCase() + link.action.slice(1)
            } ${link.handle}`,
            description: `${
              link.action.charAt(0).toUpperCase() + link.action.slice(1)
            } our ${link.platform} account: ${link.handle}`,
            url: link.url.trim(),
            required: true,
            platform: link.platform,
            handle: link.handle,
            action: link.action,
          }));
        await saveSocialMediaTasks(tasksToSend);
      }

      await setClaimParameters(
        provider as BrowserProvider,
        faucetAddress,
        claimAmountBN,
        startTimestamp,
        endTimestamp,
        BigInt(chainId),
        BigInt(Number(selectedNetwork.chainId)),
        faucetType || undefined
      );
      toast({
        title: "Drop parameters updated",
        description: `Parameters updated successfully on chain and backend.`,
      });
      await loadFaucetDetails();
      await loadTransactionHistory();
    } catch (error: any) {
      console.error("Error updating drop parameters:", error);
      toast({
        title: "Failed to update drop parameters",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingParameters(false);
    }
  };

  const handleUpdateWhitelist = async (): Promise<void> => {
    if (
      !address ||
      !provider ||
      !whitelistAddresses.trim() ||
      !chainId ||
      !checkNetwork()
    )
      return;
    try {
      setIsUpdatingWhitelist(true);
      const addresses = whitelistAddresses
        .split(/[\n,]/)
        .map((addr) => addr.trim())
        .filter((addr) => addr.length > 0);
      if (addresses.length === 0) return;
      await setWhitelistBatch(
        provider as BrowserProvider,
        faucetAddress,
        addresses,
        isWhitelistEnabled,
        BigInt(chainId),
        BigInt(Number(selectedNetwork.chainId)),
        faucetType || undefined
      );
      toast({
        title: "Drop-list updated",
        description: `${addresses.length} addresses have been ${
          isWhitelistEnabled ? "added to" : "removed from"
        } the Drop-list`,
      });
      setWhitelistAddresses("");
      await loadFaucetDetails();
      await loadTransactionHistory();
    } catch (error: any) {
      console.error("Error updating Drop-list:", error);
      toast({
        title: "Failed to update Drop-list",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingWhitelist(false);
    }
  };

  const handleResetAllClaims = async (): Promise<void> => {
    if (!address || !provider || !chainId || !checkNetwork()) return;
    try {
      setIsResettingClaims(true);
      await resetAllClaims(
        provider as BrowserProvider,
        faucetAddress,
        BigInt(chainId),
        BigInt(Number(selectedNetwork.chainId)),
        faucetType || undefined
      );
      toast({
        title: "All claims reset",
        description: "All users can now claim again",
      });
      await loadFaucetDetails();
      await loadTransactionHistory();
    } catch (error: any) {
      console.error("Error resetting all claims:", error);
      toast({
        title: "Failed to reset all claims",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsResettingClaims(false);
    }
  };

  const checkAdminStatus = (inputAddress: string): void => {
    if (!inputAddress.trim()) {
      setIsAddingAdmin(true);
      return;
    }
    const isAdmin = adminList.some(
      (admin) => admin.toLowerCase() === inputAddress.toLowerCase()
    );
    setIsAddingAdmin(!isAdmin);
  };

  const handleManageAdmin = async (): Promise<void> => {
    if (
      !address ||
      !provider ||
      !newAdminAddress.trim() ||
      !chainId ||
      !checkNetwork()
    )
      return;
    if (
      newAdminAddress.toLowerCase() === faucetDetails?.owner.toLowerCase() ||
      newAdminAddress.toLowerCase() === FACTORY_OWNER_ADDRESS.toLowerCase()
    ) {
      toast({
        title: "Cannot modify special addresses",
        description: "Owner and backend addresses are protected.",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsManagingAdmin(true);
      if (isAddingAdmin) {
        await addAdmin(
          provider as BrowserProvider,
          faucetAddress,
          newAdminAddress,
          BigInt(chainId),
          BigInt(Number(selectedNetwork.chainId)),
          faucetType || undefined
        );
        toast({
          title: "Admin added",
          description: `Address ${newAdminAddress} has been added as an admin`,
        });
      } else {
        removeAdmin(
          provider as BrowserProvider,
          faucetAddress,
          newAdminAddress,
          BigInt(chainId),
          BigInt(Number(selectedNetwork.chainId)),
          faucetType || undefined
        );
        toast({
          title: "Admin removed",
          description: `Address ${newAdminAddress} has been removed as an admin`,
        });
      }
      setNewAdminAddress("");
      setShowAddAdminDialog(false);
      await loadFaucetDetails();
    } catch (error: any) {
      console.error("Error managing admin:", error);
      toast({
        title: `Failed to ${isAddingAdmin ? "add" : "remove"} admin`,
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsManagingAdmin(false);
    }
  };

  const handleRetrieveSecretCode = async (): Promise<void> => {
    if (faucetType !== "dropcode" || !faucetAddress) return;
    try {
      setIsRetrievingSecret(true);
      const code = await retrieveSecretCode(faucetAddress);
      if (!code || code.trim() === "")
        throw new Error("Retrieved code is empty or invalid");
      setCurrentSecretCode(code);
      setShowCurrentSecretDialog(true);
      toast({
        title: "Valid Drop Code Retrieved! ",
        description: "Fresh valid code retrieved and cached",
      });
    } catch (error: any) {
      let errorMessage = error.message || "Failed to retrieve the drop code";
      toast({
        title: "Failed to retrieve Drop code",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRetrievingSecret(false);
    }
  };

  const handleGenerateNewDropCode = async (): Promise<void> => {
    if (!faucetType || !faucetAddress || !address || !chainId) return;
    if (!isOwnerOrAdmin) {
      toast({
        title: "Unauthorized",
        description: "Only owner/admin can generate new codes",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsGeneratingNewCode(true);
      const response = await fetch(
        "https://fauctdrop-backend.onrender.com/generate-new-drop-code",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            faucetAddress,
            userAddress: address,
            chainId: Number(chainId),
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate new drop code");
      }
      const result = await response.json();
      const newCode = result.secretCode;
      setNewlyGeneratedCode(newCode);
      setShowNewCodeDialog(true);
      toast({
        title: "New Drop Code Generated! ",
        description: "A fresh drop code is now active",
      });
    } catch (error: any) {
      console.error(" Failed to generate new drop code:", error);
      toast({
        title: "Failed to generate Drop code",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingNewCode(false);
    }
  };
const handleCopyLink = async (type: 'web' | 'farcaster'): Promise<void> => {
    try {
      let url = "";
      
      if (type === 'web') {
        // Copies the current browser URL (User View Link)
        // If Admin is at /faucet/[address]/admin, we might want to strip /admin
        // Assuming the user view is at the base URL of the current page:
        url = window.location.origin + "/faucet/" + faucetAddress;
      } else {
        // Constructs the Farcaster Mini-app link with the faucet address as a parameter
        // We append ?startapp={address} so the mini-app knows which faucet to open
        url = `https://farcaster.xyz/miniapps/x8wlGgdqylmp/faucetdrops?startapp/faucet=${faucetAddress}`;
      }

      await navigator.clipboard.writeText(url);
      
      toast({ 
        title: "Link Copied", 
        description: `${type === 'web' ? 'Web' : 'Farcaster'} link has been copied to clipboard.`, 
      });
    } catch (error) {
      toast({ 
        title: "Copy Failed", 
        description: "Failed to copy the link. Please try again.", 
        variant: "destructive", 
      });
    }
  };
  const handleCopySecretCode = async (code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "Code Copied",
        description: "Drop code has been copied to your clipboard.",
      });
      setShowNewCodeDialog(false);
      setShowCurrentSecretDialog(false);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy the code. Please try again.",
        variant: "destructive",
      });
    }
  };

  const addNewSocialLink = (): void => {
    setNewSocialLinks([
      ...newSocialLinks,
      { platform: "𝕏", url: "", handle: "", action: "follow" },
    ]);
  };

  const removeNewSocialLink = (index: number): void => {
    setNewSocialLinks(newSocialLinks.filter((_, i) => i !== index));
  };

  const updateNewSocialLink = (
    index: number,
    field: keyof SocialMediaLink,
    value: string
  ): void => {
    const updated = [...newSocialLinks];
    updated[index] = { ...updated[index], [field]: value };
    setNewSocialLinks(updated);
  };

  const totalPages = Math.ceil(transactions.length / 10);
  const startIndex = (currentPage - 1) * 10;
  const currentTransactions = transactions.slice(startIndex, startIndex + 10);
  const handlePageChange = (page: number): void => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const getTokenName = (isEther: boolean): string => {
    if (!isEther) return tokenSymbol;
    return selectedNetwork?.name
      ? selectedNetwork.nativeCurrency.symbol
      : "ETH";
  };

  // --- Preview Logic ---
  const handlePreview = () => {
    setShowPreviewDialog(true);
  };

  const combinedPreviewTasks = [
    ...dynamicTasks.map((task) => ({ ...task, status: "Current" })),
    ...newSocialLinks
      .filter((link) => link.handle.trim())
      .map((task) => ({ ...task, status: "New" })),
  ];

  const simulatedFaucetDetails = {
    ...faucetDetails,
    name: newFaucetName || faucetDetails.name,
    claimAmount:
      faucetType === "custom"
        ? BigInt(0)
        : parseUnits(claimAmount || "0", tokenDecimals),
    isClaimActive:
      new Date(endTime).getTime() > Date.now() &&
      new Date(startTime).getTime() <= Date.now(),
    // --- USING THE METADATA PROP ---
   // --- NEW CODE ---
    faucetMetadata: {
      description:
        faucetMetadata?.description ||
        faucetDetails?.faucetMetadata?.description || // Check existing details first
        `Preview of ${newFaucetName} Faucet`,
      imageUrl:
        faucetMetadata?.imageUrl ||
        faucetDetails?.faucetMetadata?.imageUrl || // Check existing details first
        "/default.jpeg",
    },
  };

  const renderCountdown = (timestamp: number, prefix: string): string => {
    if (timestamp === 0) return "N/A";
    const diff = timestamp * 1000 - Date.now();
    if (diff <= 0) return prefix === "Start" ? "Active" : "Ended";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const adminTabs = [
    { value: "fund", label: "Fund", icon: Upload },
    { value: "parameters", label: "Parameters", icon: Coins },
    ...(shouldShowWhitelistTab
      ? [{ value: "whitelist", label: "Drop-list", icon: Users }]
      : []),
    ...(shouldShowCustomTab
      ? [{ value: "custom", label: "Custom", icon: FileUp }]
      : []),
    { value: "admin-power", label: "Admin Power", icon: RotateCcw },
    { value: "history", label: "Activity Log", icon: History },
  ];

  return (
    <Card className="w-full mx-auto">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg sm:text-xl">
              Admin Controls
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Manage your {faucetType || "unknown"} faucet settings and monitor
              activity here.
            </CardDescription>
          </div>
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <Share2 className="h-3 w-3 mr-1" /> Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleCopyLink('web')}>
                  <Link className="h-4 w-4 mr-2" /> Copy Web Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopyLink('farcaster')}>
                  <div className="h-4 w-4 mr-2 flex items-center justify-center font-bold bg-purple-600 text-white rounded-full text-[10px]">F</div>
                  Copy Farcaster Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          <Button
            onClick={handlePreview}
            variant="secondary"
            size="sm"
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" /> View User Preview
          </Button>
        </div>
        {isOwner && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditNameDialog(true)}
              className="text-xs"
            >
              <Edit className="h-3 w-3 mr-1" /> Edit Name
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Delete Faucet
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-lg bg-muted/20">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground flex items-center">
              <Zap className="h-3 w-3 mr-1 " /> Current Balance
            </span>
            <span className="text-sm sm:text-lg font-bold truncate">
              {faucetDetails.balance
                ? formatUnits(faucetDetails.balance, tokenDecimals)
                : "0"}{" "}
              {tokenSymbol}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground flex items-center">
              <Coins className="h-3 w-3 mr-1 " /> Current Drip
            </span>
            <span className="text-sm sm:text-lg font-bold truncate">
              {faucetType === "custom"
                ? "Custom"
                : faucetDetails.claimAmount
                ? formatUnits(faucetDetails.claimAmount, tokenDecimals)
                : "0"}{" "}
              {faucetType !== "custom" ? tokenSymbol : ""}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground flex items-center">
              <Clock className="h-3 w-3 mr-1 " /> Live Status
            </span>
            <span className="text-sm sm:text-lg font-bold truncate">
              {faucetDetails.isClaimActive ? (
                <Badge variant="default" className="bg-green-500">
                  Active
                </Badge>
              ) : (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground flex items-center">
              <Clock className="h-3 w-3 mr-1 " /> Ends In
            </span>
            <span className="text-sm sm:text-lg font-bold truncate">
              {faucetDetails.isClaimActive &&
              Number(faucetDetails.endTime) > 0
                ? renderCountdown(Number(faucetDetails.endTime), "End")
                : "N/A"}
            </span>
          </div>
        </div>
      </CardContent>
      <CardContent className="px-4 sm:px-6">
        <Tabs
          defaultValue="fund"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <div className="sm:hidden mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {adminTabs.find((tab) => tab.value === activeTab)?.label ||
                    "Menu"}{" "}
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                {adminTabs.map((tab) => (
                  <DropdownMenuItem
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                  >
                    <tab.icon className="h-4 w-4 mr-2" /> {tab.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <TabsList
            className={`hidden sm:grid gap-2 w-full ${
              shouldShowWhitelistTab && shouldShowCustomTab
                ? "grid-cols-6"
                : shouldShowWhitelistTab || shouldShowCustomTab
                ? "grid-cols-5"
                : "grid-cols-4"
            }`}
          >
            {adminTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs sm:text-sm"
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <TabsContent value="fund" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="p-4 border shadow-sm">
                <CardTitle className="text-base font-semibold mb-3 flex items-center">
                  <Upload className="h-4 w-4 mr-2" /> Fund Faucet
                </CardTitle>
                <div className="space-y-3">
                  <Label htmlFor="fund-amount" className="text-xs sm:text-sm">
                    Amount to Deposit
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="fund-amount"
                      placeholder="0.0"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      className="text-xs sm:text-sm"
                    />
                    <Button
                      onClick={handleFund}
                      disabled={isFunding || !fundAmount}
                      className="text-xs sm:text-sm"
                    >
                      {isFunding ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Funding...
                        </span>
                      ) : (
                        `Fund ${tokenSymbol}`
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Includes a 3% platform fee. Net amount:{" "}
                    {calculateFee(fundAmount).netAmount} {tokenSymbol}
                  </p>
                </div>
              </Card>
              <Card className="p-4 border shadow-sm">
                <CardTitle className="text-base font-semibold mb-3 flex items-center">
                  <Download className="h-4 w-4 mr-2" /> Withdraw Tokens
                </CardTitle>
                <div className="space-y-3">
                  <Label
                    htmlFor="withdraw-amount"
                    className="text-xs sm:text-sm"
                  >
                    Amount to Withdraw
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="withdraw-amount"
                      placeholder="0.0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="text-xs sm:text-sm"
                    />
                    <Button
                      onClick={handleWithdraw}
                      disabled={isWithdrawing || !withdrawAmount}
                      variant="outline"
                      className="text-xs sm:text-sm"
                    >
                      {isWithdrawing ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Withdrawing...
                        </span>
                      ) : (
                        `Withdraw ${tokenSymbol}`
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Withdraw available {tokenSymbol} from the faucet balance.
                  </p>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="parameters" className="space-y-6 mt-6">
            <Card className="p-4 border shadow-sm space-y-4">
              <CardTitle className="text-base font-semibold border-b pb-2 flex items-center">
                <Coins className="h-4 w-4 mr-2" /> Drip & Timing Parameters
              </CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {faucetType !== "custom" && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="claim-amount"
                      className="text-xs sm:text-sm"
                    >
                      Drip Amount ({tokenSymbol})
                    </Label>
                    <Input
                      id="claim-amount"
                      placeholder="0.0"
                      value={claimAmount}
                      onChange={(e) => setClaimAmount(e.target.value)}
                      className="text-xs sm:text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Amount each user can drip per claim.
                    </p>
                  </div>
                )}
                {faucetType !== "custom" ? <div></div> : <></>}
                <div className="space-y-2">
                  <Label htmlFor="start-time" className="text-xs sm:text-sm">
                    Start Time
                  </Label>
                  <Input
                    id="start-time"
                    type="datetime-local"
                    value={startTime}
                    min={getCurrentDateTime()}
                    onChange={handleStartTimeChange}
                    className={`text-xs sm:text-sm ${
                      startTimeError ? "border-red-500" : ""
                    }`}
                  />
                  {startTimeError && (
                    <p className="text-red-600 text-xs mt-1">
                      {startTimeError}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time" className="text-xs sm:text-sm">
                    End Time
                  </Label>
                  <Input
                    id="end-time"
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="text-xs sm:text-sm"
                  />
                </div>
              </div>
            </Card>
            <Card className="p-4 border shadow-sm space-y-4">
              <CardTitle className="text-base font-semibold border-b pb-2 flex items-center">
                <Link className="h-4 w-4 mr-2" /> Required Social Tasks
              </CardTitle>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Add links users must{" "}
                    {dynamicTasks.length > 0 ? "complete/verify" : "complete"}{" "}
                    before claiming.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addNewSocialLink}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Add Task
                </Button>
              </div>
              {dynamicTasks.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Currently Saved Tasks ({dynamicTasks.length})
                  </Label>
                  <div className="space-y-1">
                    {dynamicTasks.map((task, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted rounded text-xs"
                      >
                        <span className="truncate">
                          {getPlatformIcon(task.platform)}{" "}
                          {getActionText(task.platform)} {task.handle}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {task.platform}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {newSocialLinks.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-xs font-medium">New Tasks</Label>
                  {newSocialLinks.map((link, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">
                          Task {index + 1}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeNewSocialLink(index)}
                          className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Platform</Label>
                          <Select
                            value={link.platform}
                            onValueChange={(value) =>
                              updateNewSocialLink(index, "platform", value)
                            }
                          >
                            <SelectTrigger className="text-xs">
                              <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="𝕏">Twitter/𝕏</SelectItem>
                              <SelectItem value="telegram">Telegram</SelectItem>
                              <SelectItem value="discord">Discord</SelectItem>
                              <SelectItem value="youtube">YouTube</SelectItem>
                              <SelectItem value="instagram">Instagram</SelectItem>
                              <SelectItem value="tiktok">TikTok</SelectItem>
                              <SelectItem value="facebook">Facebook</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Action</Label>
                          <Select
                            value={link.action}
                            onValueChange={(value) =>
                              updateNewSocialLink(index, "action", value)
                            }
                          >
                            <SelectTrigger className="text-xs">
                              <SelectValue placeholder="Select action" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="follow">Follow</SelectItem>
                              <SelectItem value="subscribe">Subscribe</SelectItem>
                              <SelectItem value="join">Join</SelectItem>
                              <SelectItem value="like">Like</SelectItem>
                              <SelectItem value="retweet">Retweet</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">URL</Label>
                        <Input
                          placeholder="https://x.com/username"
                          value={link.url}
                          onChange={(e) =>
                            updateNewSocialLink(index, "url", e.target.value)
                          }
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Handle/Username</Label>
                        <Input
                          placeholder="@username"
                          value={link.handle}
                          onChange={(e) =>
                            updateNewSocialLink(index, "handle", e.target.value)
                          }
                          className="text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card className="p-4 border shadow-sm space-y-4">
              <CardTitle className="text-base font-semibold border-b pb-2 flex items-center">
                <Share2 className="h-4 w-4 mr-2" /> Custom Share Post
              </CardTitle>
              <div>
                <p className="text-xs text-muted-foreground">
                  Customize the message users share after a successful drip.
                </p>
                <p className="text-xs font-mono text-blue-500 mt-1">
                  Placeholders: {"{amount}"}, {"{token}"}, {"{network}"},{" "}
                  {"{explorer}"}
                </p>
              </div>
              <Textarea
                placeholder="..."
                value={customXPostTemplate}
                onChange={(e) => setCustomXPostTemplate(e.target.value)}
                rows={4}
                className="text-xs font-mono"
              />
            </Card>
            <Button
              onClick={handleUpdateClaimParameters}
              className="text-xs sm:text-sm w-full"
              disabled={isUpdatingParameters}
            >
              {isUpdatingParameters ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Updating Parameters...
                </span>
              ) : (
                "Save & Update Parameters"
              )}
            </Button>
            {shouldShowSecretCodeButton && (
              <div className="flex flex-col sm:flex-row gap-3 w-full pt-4">
                <Button
                  onClick={handleRetrieveSecretCode}
                  variant="outline"
                  className="text-xs sm:text-sm w-full"
                  disabled={isRetrievingSecret}
                >
                  {isRetrievingSecret ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Retrieving...
                    </span>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-1" /> Get Current Code
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleGenerateNewDropCode}
                  variant="outline"
                  className="text-xs sm:text-sm w-full"
                  disabled={isGeneratingNewCode}
                >
                  {isGeneratingNewCode ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Generating...
                    </span>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-1" /> Generate New Code
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          {shouldShowWhitelistTab && (
            <TabsContent value="whitelist" className="space-y-4 mt-4">
              <Card className="p-4 border shadow-sm space-y-4">
                <CardTitle className="text-base font-semibold border-b pb-2 flex items-center">
                  <Users className="h-4 w-4 mr-2" /> Manage Drop-list
                </CardTitle>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs sm:text-sm font-medium">
                      {isWhitelistEnabled
                        ? "Batch Add Addresses"
                        : "Batch Remove Addresses"}
                    </Label>
                    <Switch
                      checked={isWhitelistEnabled}
                      onCheckedChange={setIsWhitelistEnabled}
                    />
                  </div>
                  <Label
                    htmlFor="whitelist-addresses"
                    className="text-xs sm:text-sm text-muted-foreground"
                  >
                    Addresses (one per line or comma-separated)
                  </Label>
                  <Textarea
                    id="whitelist-addresses"
                    value={whitelistAddresses}
                    onChange={(e) => setWhitelistAddresses(e.target.value)}
                    rows={5}
                    className="text-xs sm:text-sm"
                  />
                </div>
                <Button
                  onClick={handleUpdateWhitelist}
                  className="text-xs sm:text-sm w-full"
                  disabled={isUpdatingWhitelist}
                >
                  {isUpdatingWhitelist ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Updating...
                    </span>
                  ) : (
                    "Update Drop-list"
                  )}
                </Button>
              </Card>
            </TabsContent>
          )}

          {shouldShowCustomTab && (
            <TabsContent value="custom" className="space-y-4 mt-4">
              <Card className="p-4 border shadow-sm space-y-4">
                <CardTitle className="text-base font-semibold border-b pb-2 flex items-center">
                  <FileUp className="h-4 w-4 mr-2" /> Upload Custom Claim Amounts
                </CardTitle>
                <CustomClaimUploader
                  tokenSymbol={tokenSymbol}
                  tokenDecimals={tokenDecimals}
                  onDataParsed={async (addresses, amounts) => {
                    if (!address || !provider || !chainId || !checkNetwork())
                      return;
                    try {
                      console.log(
                        `Simulating setting custom amounts for ${addresses.length} addresses`
                      );
                      await setCustomClaimAmountsBatch(
                        provider as BrowserProvider,
                        faucetAddress,
                        addresses,
                        amounts,
                        BigInt(chainId),
                        BigInt(Number(selectedNetwork.chainId)),
                        faucetType || undefined
                      );
                      toast({
                        title: "Custom claim amounts set",
                        description: `Successfully set custom amounts for ${addresses.length} addresses`,
                      });
                      await loadFaucetDetails();
                      await loadTransactionHistory();
                    } catch (error: any) {
                      toast({
                        title: "Failed to set custom claim amounts",
                        description:
                          error.message || "Unknown error occurred",
                        variant: "destructive",
                      });
                    }
                  }}
                  onCancel={() => {}}
                />
              </Card>
            </TabsContent>
          )}

          <TabsContent value="admin-power" className="space-y-6 mt-6">
            <Card className="p-4 border shadow-sm space-y-4">
              <CardTitle className="text-base font-semibold border-b pb-2 flex items-center">
                <Users className="h-4 w-4 mr-2" /> Admin List
              </CardTitle>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Active Admins</Label>
                <div className="space-y-2">
                  {adminList
                    .filter(
                      (admin) =>
                        admin.toLowerCase() !==
                        FACTORY_OWNER_ADDRESS.toLowerCase()
                    )
                    .map((admin) => (
                      <div
                        key={admin}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      >
                        <span className="font-mono break-all text-xs sm:text-sm">
                          {admin}
                        </span>
                        <div className="flex gap-2">
                          {admin.toLowerCase() ===
                            faucetDetails?.owner.toLowerCase() && (
                            <Badge variant="secondary" className="text-xs">
                              Owner
                            </Badge>
                          )}
                          {admin.toLowerCase() !==
                            faucetDetails?.owner.toLowerCase() && (
                            <Badge variant="outline" className="text-xs">
                              Admin
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              {isOwner && (
                <div className="space-y-2 pt-4 border-t">
                  <Label
                    htmlFor="new-admin"
                    className="text-xs sm:text-sm font-medium"
                  >
                    {isAddingAdmin ? "Add New Admin" : "Remove Admin"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-admin"
                      placeholder="0x..."
                      value={newAdminAddress}
                      onChange={(e) => {
                        setNewAdminAddress(e.target.value);
                        checkAdminStatus(e.target.value);
                      }}
                      className="text-xs sm:text-sm font-mono"
                    />
                    <Button
                      onClick={() => setShowAddAdminDialog(true)}
                      disabled={isManagingAdmin || !newAdminAddress.trim()}
                      className="text-xs sm:text-sm"
                    >
                      {isManagingAdmin ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          {isAddingAdmin ? "Adding..." : "Removing..."}
                        </span>
                      ) : isAddingAdmin ? (
                        "Add Admin"
                      ) : (
                        "Remove Admin"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Note: Owner and protected backend addresses cannot be
                    modified here.
                  </p>
                </div>
              )}
            </Card>
            <Card className="p-4 border shadow-sm space-y-4">
              <CardTitle className="text-base font-semibold border-b pb-2 flex items-center">
                <RotateCcw className="h-4 w-4 mr-2" /> Reset Claims
              </CardTitle>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Wipe the claim history for all users, allowing everyone to
                  claim tokens again.
                </p>
                <Button
                  onClick={handleResetAllClaims}
                  variant="destructive"
                  className="text-xs sm:text-sm"
                  disabled={isResettingClaims}
                >
                  {isResettingClaims ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Resetting...
                    </span>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-1" /> Reset All Claims
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <Card className="p-4 border shadow-sm space-y-4">
              <CardTitle className="text-base font-semibold border-b pb-2 flex items-center">
                <History className="h-4 w-4 mr-2" /> Activity Log (Last 100
                Events)
              </CardTitle>
              <Label className="text-xs sm:text-sm">
                Recent Faucet Transactions (All Admins)
              </Label>
              {transactions.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">
                          Type
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Initiator
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Amount
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Token
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Date
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentTransactions.map((tx, index) => (
                        <TableRow key={`${tx.timestamp}-${index}`}>
                          <TableCell className="text-xs sm:text-sm capitalize">
                            {tx.transactionType}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm font-mono truncate max-w-[150px]">
                            {tx.initiator.slice(0, 6)}...
                            {tx.initiator.slice(-4)}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {formatUnits(tx.amount, tokenDecimals)}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {getTokenName(tx.isEther)}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {new Date(tx.timestamp * 1000).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  No transactions found
                </p>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* --- Dialogs --- */}

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="w-11/12 max-w-[95vw] sm:max-w-xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center text-blue-600">
              <Eye className="h-5 w-5 mr-2" /> User View Preview
            </DialogTitle>
            <DialogDescription className="text-sm">
              This preview uses the latest saved and unsaved parameter values.
            </DialogDescription>
            {combinedPreviewTasks.length > 0 && (
              <div className="mt-3 p-3 bg-muted rounded-lg space-y-1">
                <p className="text-xs font-semibold flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1 text-green-600" /> Total
                  Tasks Configured: {combinedPreviewTasks.length}
                </p>
                <ul className="text-xs text-muted-foreground list-disc pl-5">
                  {combinedPreviewTasks.map((task, index) => (
                    <li key={index}>
                      {task.platform}: {getActionText(task.platform)}{" "}
                      {task.handle} ({task.status})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </DialogHeader>
          <div className="py-4 border-t">
            <FaucetUserView
              faucetAddress={faucetAddress}
              faucetDetails={simulatedFaucetDetails}
              faucetType={faucetType}
              tokenSymbol={tokenSymbol}
              tokenDecimals={tokenDecimals}
              selectedNetwork={selectedNetwork}
              address={null}
              isConnected={false}
              hasClaimed={false}
              userIsWhitelisted={faucetType === "droplist" ? true : false}
              hasCustomAmount={faucetType === "custom" ? true : false}
              userCustomClaimAmount={parseUnits("100", tokenDecimals)}
              dynamicTasks={combinedPreviewTasks}
              allAccountsVerified={false}
              secretCode={""}
              setSecretCode={() => {}}
              usernames={{}}
              setUsernames={() => {}}
              verificationStates={{}}
              setVerificationStates={() => {}}
              isVerifying={false}
              faucetMetadata={simulatedFaucetDetails.faucetMetadata}
              customXPostTemplate={customXPostTemplate}
              handleBackendClaim={() => {
                toast({
                  title: "Action Disabled",
                  description: "This is a non-functional preview.",
                  variant: "destructive",
                });
                return Promise.resolve();
              }}
              handleFollowAll={() =>
                toast({
                  title: "Preview Mode",
                  description: "Tasks are disabled in preview.",
                  variant: "default",
                })
              }
              generateXPostContent={(a) => `Preview: ${a} ${tokenSymbol}`}
              txHash={null}
              showFollowDialog={false}
              setShowFollowDialog={() => {}}
              showVerificationDialog={false}
              setShowVerificationDialog={() => {}}
              showClaimPopup={false}
              setShowClaimPopup={() => {}}
              handleVerifyAllTasks={() => Promise.resolve()}
              handleGoBack={() => setShowPreviewDialog(false)}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPreviewDialog(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFundPopup} onOpenChange={setShowFundPopup}>
        <DialogContent className="w-11/12 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              Confirm Funding
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Review the funding details before proceeding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adjusted-fund-amount" className="text-xs sm:text-sm">
                Amount to Fund
              </Label>
              <Input
                id="adjusted-fund-amount"
                value={adjustedFundAmount}
                onChange={(e) => setAdjustedFundAmount(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Platform fee (3%): {fee} {tokenSymbol}
              </p>
              <p>
                Net amount to faucet: {netAmount} {tokenSymbol}
              </p>
              <p className="text-blue-600">
                Tip: To fund exactly {fundAmount} {tokenSymbol}, enter{" "}
                {recommendedInput} {tokenSymbol}
              </p>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFundPopup(false)}
              className="text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmFund}
              className="text-xs sm:text-sm"
              disabled={isFunding}
            >
              {isFunding ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Confirming...
                </span>
              ) : (
                "Confirm Fund"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditNameDialog} onOpenChange={setShowEditNameDialog}>
        <DialogContent className="w-11/12 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              Edit Faucet Name
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Enter a new name for your faucet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-faucet-name" className="text-xs sm:text-sm">
                New Faucet Name
              </Label>
              <Input
                id="new-faucet-name"
                value={newFaucetName}
                onChange={(e) => setNewFaucetName(e.target.value)}
                placeholder="Enter new faucet name"
                className="text-xs sm:text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditNameDialog(false);
                if (faucetDetails?.name) {
                  setNewFaucetName(faucetDetails.name);
                }
              }}
              className="text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateFaucetName}
              className="text-xs sm:text-sm"
              disabled={isUpdatingName || !newFaucetName.trim()}
            >
              {isUpdatingName ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Updating...
                </span>
              ) : (
                "Update Name"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="w-11/12 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              Delete Faucet
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Are you sure you want to delete this faucet? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFaucet}
              className="text-xs sm:text-sm"
              disabled={isDeletingFaucet}
            >
              {isDeletingFaucet ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Deleting...
                </span>
              ) : (
                "Delete Faucet"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAdminDialog} onOpenChange={setShowAddAdminDialog}>
        <DialogContent className="w-11/12 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {isAddingAdmin ? "Add Admin" : "Remove Admin"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {isAddingAdmin
                ? "Enter the address to grant admin privileges."
                : "Enter the address to revoke admin privileges."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-address" className="text-xs sm:text-sm">
                Admin Address
              </Label>
              <Input
                id="admin-address"
                value={newAdminAddress}
                onChange={(e) => {
                  setNewAdminAddress(e.target.value);
                  checkAdminStatus(e.target.value);
                }}
                placeholder="0x..."
                className="text-xs sm:text-sm font-mono"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddAdminDialog(false)}
              className="text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleManageAdmin}
              className="text-xs sm:text-sm"
              disabled={isManagingAdmin || !newAdminAddress.trim()}
            >
              {isManagingAdmin ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  {isAddingAdmin ? "Adding..." : "Removing..."}
                </span>
              ) : isAddingAdmin ? (
                "Add Admin"
              ) : (
                "Remove Admin"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCurrentSecretDialog}
        onOpenChange={setShowCurrentSecretDialog}
      >
        <DialogContent className="w-11/12 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              Current Drop Code
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              This is the current drop code for your faucet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-mono font-bold bg-gray-100 dark:bg-gray-800 p-4 rounded">
                {currentSecretCode}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => handleCopySecretCode(currentSecretCode)}
              className="text-xs sm:text-sm w-full"
            >
              <Copy className="h-4 w-4 mr-1" /> Copy Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewCodeDialog} onOpenChange={setShowNewCodeDialog}>
        <DialogContent className="w-11/12 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              New Drop Code Generated
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Your new drop code has been generated and stored. The previous
              code is no longer valid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-mono font-bold bg-gray-100 dark:bg-gray-800 p-4 rounded">
                {newlyGeneratedCode}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => handleCopySecretCode(newlyGeneratedCode)}
              className="text-xs sm:text-sm w-full"
            >
              <Copy className="h-4 w-4 mr-1" /> Copy New Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FaucetAdminView;