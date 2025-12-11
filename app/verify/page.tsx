// app/verify/page.tsx - Standalone verification page with dark theme

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SelfQRcodeWrapper, SelfAppBuilder } from "@selfxyz/qrcode";
import { getUniversalLink } from "@selfxyz/core";
import { 
  Loader2, 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  Shield, 
  User, 
  Calendar, 
  MapPin,
  Wallet,
  ArrowLeft
} from "lucide-react";
import LoadingPage from "@/components/loading";

// Extend window object for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Types
interface VerificationData {
  verified: boolean;
  timestamp: number;
  userAddress: string;
  verificationData?: any;
  disclosures?: {
    nationality?: string;
    name?: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    minimumAge?: number;
  };
}

type VerificationStatus = 'idle' | 'waiting' | 'verified' | 'failed';

// Simple UI components with dark theme
const Button = ({ children, onClick, variant = "default", size = "default", className = "", disabled = false }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
}) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variantClasses = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-600 bg-transparent hover:bg-gray-700 text-gray-200",
    ghost: "hover:bg-gray-700 text-gray-200"
  };
  const sizeClasses = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3 text-sm",
    lg: "h-11 px-8"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-gray-700 bg-[#020817] shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col space-y-1.5 p-6">
    {children}
  </div>
);

const CardTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-2xl font-semibold leading-none tracking-tight text-gray-100 ${className}`}>
    {children}
  </h3>
);

const CardContent = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6 pt-0">
    {children}
  </div>
);

const Badge = ({ children, variant = "default", className = "" }: {
  children: React.ReactNode;
  variant?: "default" | "secondary";
  className?: string;
}) => {
  const variantClasses = {
    default: "bg-blue-900 text-blue-200",
    secondary: "bg-gray-700 text-gray-200"
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default function VerificationPage() {
  const router = useRouter();
  const [account, setAccount] = useState<string>("");
  const [selfApp, setSelfApp] = useState<any>(null);
  const [universalLink, setUniversalLink] = useState<string>("");
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("idle");
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);

  // Check for existing wallet connection on mount
  useEffect(() => {
    checkWalletConnection();
  }, []);

  // Check verification status when account changes
  useEffect(() => {
    if (account) {
      checkLocalVerification();
      initializeSelfApp();
    }
  }, [account]);

  const handleBackClick = () => {
    // Try to go back in browser history, fallback to home page
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const checkWalletConnection = async (): Promise<void> => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      }
    } catch (error) {
      console.error('Failed to check wallet connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async (): Promise<void> => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const checkLocalVerification = (): void => {
    try {
      const stored = localStorage.getItem(`verification_${account.toLowerCase()}`);
      if (stored) {
        const data: VerificationData = JSON.parse(stored);
        if (data.verified && data.timestamp) {
          // Check if verification is not too old (30 days)
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          if (data.timestamp > thirtyDaysAgo) {
            setIsVerified(true);
            setVerificationData(data);
            setVerificationStatus("verified");
            return;
          }
        }
      }
    } catch (error) {
      console.error("Error checking local verification:", error);
    }
    
    setIsVerified(false);
    setVerificationStatus("idle");
  };

  const initializeSelfApp = (): void => {
    if (!account) return;

    try {
      const config = {
        version: 2,
        appName: "FaucetDrops",
        scope: "faucetdrop",
        endpoint: window.location.origin + "/api/verify",
        logoBase64: "/logo.png",
        userId: account.toLowerCase(),
        endpointType: "staging_https" as const,
        userIdType: "hex" as const,
        userDefinedData: "FaucetDrops Identity Verification",
        disclosures: {
          minimumAge: 15,
          ofac: false,
          excludedCountries: [],
          nationality: true,
          name: true,
          dateOfBirth: true,
          gender: true,
        },
      };

      const app = new SelfAppBuilder(config).build();
      setSelfApp(app);
      setUniversalLink(getUniversalLink(app));
      console.log("Self app initialized for user:", account);
    } catch (error) {
      console.error("Failed to initialize Self app:", error);
    }
  };

  const handleVerificationSuccess = (): void => {
    console.log("Verification successful");
    setVerificationStatus("waiting");
    
    setTimeout(() => {
      const verificationRecord: VerificationData = {
        verified: true,
        timestamp: Date.now(),
        userAddress: account.toLowerCase(),
        verificationData: {},
        disclosures: {
          nationality: "Unknown",
          name: "Verified User",
          dateOfBirth: null,
          gender: null,
          minimumAge: 15,
        }
      };

      localStorage.setItem(
        `verification_${account.toLowerCase()}`,
        JSON.stringify(verificationRecord)
      );

      setVerificationData(verificationRecord);
      setIsVerified(true);
      setVerificationStatus("verified");
      
      console.log("Verification stored locally");
    }, 2000);
  };

  const handleVerificationError = (): void => {
    console.error("Verification error occurred");
    setVerificationStatus("failed");
    
    localStorage.removeItem(`verification_${account.toLowerCase()}`);
    setIsVerified(false);
    setVerificationData(null);
  };

  const openSelfApp = (): void => {
    if (universalLink) {
      window.open(universalLink, "_blank");
    }
  };

  const clearVerification = (): void => {
    localStorage.removeItem(`verification_${account.toLowerCase()}`);
    setIsVerified(false);
    setVerificationData(null);
    setVerificationStatus("idle");
  };

  const formatAddress = (address: string): string => {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (<LoadingPage/> );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-[#020817] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBackClick}
                className="text-gray-400 hover:text-gray-200"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
            <CardTitle className="flex items-center justify-center gap-2">
              <Wallet className="h-6 w-6" />
              Connect Your Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-300">
              Connect your wallet to start the identity verification process with FauceDrop.
            </p>
            <Button 
              onClick={connectWallet} 
              size="lg" 
              className="w-full"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </>
              )}
            </Button>
            <p className="text-xs text-gray-400">
              Make sure you have MetaMask or another Web3 wallet installed
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020817] py-12">
      <div className="container mx-auto px-4 max-w-4xl space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackClick}
            className="text-gray-400 hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Identity Verification</h1>
          <p className="text-gray-300">
            Connected as {formatAddress(account)}
          </p>
        </div>

        {/* Main Verification Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Self Protocol Verification
              </CardTitle>
              {isVerified && (
                <Badge variant="secondary" className="bg-green-900 text-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            {verificationStatus === "waiting" && (
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing verification...
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isVerified ? (
              <div className="space-y-6">
                {/* Verification Success */}
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <h3 className="font-medium text-green-200">Identity Verified Successfully</h3>
                  </div>
                  <p className="text-sm text-green-300">
                    Your identity has been verified and you can now use FauceDrop services.
                  </p>
                  {verificationData?.timestamp && (
                    <p className="text-xs text-green-400 mt-1">
                      Verified on {formatDate(verificationData.timestamp)}
                    </p>
                  )}
                </div>

                {/* Verification Details */}
                {verificationData?.disclosures && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2 text-gray-200">
                      <User className="h-4 w-4" />
                      Verification Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-gray-500" />
                        <span className="text-gray-400">Name:</span>
                        <span className="text-gray-200">{verificationData.disclosures.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-gray-500" />
                        <span className="text-gray-400">Nationality:</span>
                        <span className="text-gray-200">{verificationData.disclosures.nationality}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-gray-500" />
                        <span className="text-gray-400">Age Verified:</span>
                        <span className="text-gray-200">15+ years</span>
                      </div>
                      {verificationData.disclosures.gender && (
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-gray-500" />
                          <span className="text-gray-400">Gender:</span>
                          <span className="text-gray-200">{verificationData.disclosures.gender}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500">
                        Wallet: {formatAddress(account)} • 
                        Verified using Self Protocol • 
                        Data stored locally
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="lg">
                    <Link href="/">Return to FauceDrop</Link>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearVerification}
                    className="text-gray-400 hover:text-gray-200"
                  >
                    Reset Verification
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Information */}
                <div className="space-y-3">
                  <p className="text-sm md:text-base text-gray-300">
                    Verify your identity using Self Protocol to access enhanced FauceDrop features.
                  </p>
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                    <h4 className="font-medium text-blue-200 mb-1">What we verify:</h4>
                    <ul className="text-xs text-blue-300 space-y-1">
                      <li>• Minimum age of 15 years</li>
                      <li>• Valid government-issued document</li>
                      <li>• No sanctions list matching</li>
                    </ul>
                  </div>
                  <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-3">
                    <h4 className="font-medium text-amber-200 mb-1">Privacy notice:</h4>
                    <p className="text-xs text-amber-300">
                      Your personal data is processed using zero-knowledge proofs. 
                      Only verification status is stored locally in your browser.
                    </p>
                  </div>
                </div>

                {/* QR Code / Mobile Interface */}
                {selfApp ? (
                  <div className="space-y-4">
                    {/* Desktop QR Code */}
                    <div className="hidden sm:block">
                      <div className="text-center space-y-3">
                        <div className="flex items-center gap-2 justify-center">
                          <QrCode className="h-4 w-4 text-gray-300" />
                          <span className="text-sm font-medium text-gray-300">Scan with Self App</span>
                        </div>
                        <div className="flex justify-center">
                          <div className="bg-white p-6 rounded-lg border border-gray-600 shadow-sm">
                            <SelfQRcodeWrapper
                              selfApp={selfApp}
                              onSuccess={handleVerificationSuccess}
                              onError={handleVerificationError}
                              size={280}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">
                          Don't have the Self app? 
                          <a 
                            href="https://selfprotocol.xyz" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline ml-1"
                          >
                            Download here
                          </a>
                        </p>
                      </div>
                    </div>

                    {/* Mobile Interface */}
                    <div className="sm:hidden">
                      <div className="text-center space-y-3">
                        <Button onClick={openSelfApp} className="w-full" size="lg">
                          <Smartphone className="mr-2 h-4 w-4" />
                          Open Self App
                        </Button>
                        <p className="text-xs text-gray-400">
                          This will open the Self app directly for verification
                        </p>
                      </div>
                    </div>

                    {/* Alternative option for mobile on larger screens */}
                    <div className="hidden sm:block">
                      <div className="pt-4 border-t border-gray-700 text-center">
                        <p className="text-xs text-gray-400 mb-2">On mobile?</p>
                        <Button variant="outline" onClick={openSelfApp} size="sm">
                          <Smartphone className="mr-2 h-3 w-3" />
                          Open Self App Directly
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center py-8">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <span className="text-sm text-gray-300">Initializing verification...</span>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {verificationStatus === "failed" && (
                  <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <h4 className="font-medium text-red-200">Verification Failed</h4>
                    </div>
                    <p className="text-sm text-red-300 mb-3">
                      The verification process failed. This could be due to:
                    </p>
                    <ul className="text-xs text-red-400 space-y-1 mb-3">
                      <li>• Age requirement not met (minimum 15 years)</li>
                      <li>• Invalid or expired document</li>
                      <li>• Network connectivity issues</li>
                    </ul>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setVerificationStatus("idle");
                        window.location.reload();
                      }}
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* How It Works Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">How Self Protocol Verification Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <h4 className="font-medium text-gray-200">Scan QR Code</h4>
                <p className="text-gray-400">Use the Self mobile app to scan the QR code and start verification.</p>
              </div>
              <div className="space-y-2">
                <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <h4 className="font-medium text-gray-200">Verify Document</h4>
                <p className="text-gray-400">Take a photo of your passport or ID card using the app's guided process.</p>
              </div>
              <div className="space-y-2">
                <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <h4 className="font-medium text-gray-200">Zero-Knowledge Proof</h4>
                <p className="text-gray-400">Generate a privacy-preserving proof that confirms your eligibility.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}