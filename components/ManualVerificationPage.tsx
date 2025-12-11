// src/pages/ManualVerificationPage.tsx
"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Check, 
  X, 
  Loader2,
  Users,
  Eye,
  Link as LinkIcon,
  Upload
} from "lucide-react"
import { useWallet } from "@/hooks/use-wallet" 
import { useNetwork } from "@/hooks/use-network" 
// import { toast } from "@/hooks/use-toast" // Assuming useToast hook
const toast = console.log; // Using console.log as mock toast

// --- CONSTANTS ---
const API_BASE_URL = "https://fauctdrop-backend.onrender.com"

// --- Data Structures ---
interface QuestSummary {
    id: string;
    title: string;
    faucetAddress: string;
}
interface Submission {
    id: string;
    userId: string;
    taskId: string;
    taskTitle: string;
    proofType: 'manual_link' | 'manual_upload';
    proofData: string;
    status: 'pending';
    points: number;
}

// NOTE: Mock Header component since the source wasn't provided for this utility
const Header = ({ pageTitle }: { pageTitle: string }) => <h1 className="text-3xl font-bold">{pageTitle}</h1>;

export default function ManualVerificationPage() {
    const { address, isConnected, chainId } = useWallet(); 
    const { network, isConnecting: isNetworkConnecting } = useNetwork(); 

    const [quests, setQuests] = useState<QuestSummary[]>([]);
    const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    
    const [isQuestsLoading, setIsQuestsLoading] = useState(true);
    const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);

    // 1. Fetch Quests belonging to the owner (LIVE API CALL)
    useEffect(() => {
        if (!address || !isConnected || isNetworkConnecting) {
            setQuests([]);
            setIsQuestsLoading(false);
            return;
        }

        const fetchQuests = async () => {
            setIsQuestsLoading(true);
            try {
                // Fetch quests owned by the connected address that require manual verification
                const response = await fetch(`${API_BASE_URL}/api/quests/owner/${address}?status=manual_pending`);
                if (!response.ok) throw new Error('Failed to fetch quests.');
                
                const data: QuestSummary[] = await response.json();
                setQuests(data);

                // Auto-select the first quest if available
                if (data.length > 0) {
                    setSelectedQuestId(data[0].id);
                } else {
                    setSelectedQuestId(null);
                }
            } catch (e: any) {
                setPageError(e.message);
                console.error("Error fetching quests:", e);
            } finally {
                setIsQuestsLoading(false);
            }
        };

        fetchQuests();
    }, [address, isConnected, isNetworkConnecting]);
    

    // 2. Fetch submissions for the selected quest (LIVE API CALL)
    const fetchSubmissions = useCallback(async () => {
        if (!selectedQuestId) {
            setSubmissions([]);
            return;
        }

        setIsSubmissionsLoading(true);
        try {
            // Endpoint to fetch all pending manual submissions for a specific quest
            const response = await fetch(`${API_BASE_URL}/api/submissions/quest/${selectedQuestId}/pending`);
            if (!response.ok) throw new Error('Failed to fetch submissions.');
            
            const data: Submission[] = await response.json();
            setSubmissions(data);
        } catch (e: any) {
            setPageError(`Failed to load submissions: ${e.message}`);
            console.error("Error fetching submissions:", e);
        } finally {
            setIsSubmissionsLoading(false);
        }
    }, [selectedQuestId]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);


    // 3. Handle Verification Action (Approve/Reject) (LIVE API CALL)
    const handleVerification = async (submissionId: string, status: 'approved' | 'rejected', points: number) => {
        if (isProcessing) return;

        setIsProcessing(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/submissions/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    submissionId,
                    status,
                    verifierAddress: address,
                    pointsAwarded: status === 'approved' ? points : 0,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Failed to ${status} submission.`);
            }

            // Success: Update local state and show toast
            setSubmissions(prev => prev.filter(sub => sub.id !== submissionId));
            toast({
                title: `${status === 'approved' ? 'Approved' : 'Rejected'}!`,
                description: `Submission ${submissionId.slice(-4)} processed successfully.`,
            });
        } catch (e: any) {
            setPageError(e.message);
            console.error("Verification failed:", e);
        } finally {
            setIsProcessing(false);
        }
    };


    // --- Render Logic ---

    if (isQuestsLoading || isNetworkConnecting) {
        return (
            <div className="max-w-6xl mx-auto p-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto my-12" />
                <p>Loading owner data...</p>
            </div>
        );
    }
    
    if (!address) {
        return (
            <div className="max-w-6xl mx-auto p-6 space-y-4 text-center">
                <Header pageTitle="Manual Quest Verification" />
                <Card><CardContent className="py-8">Please connect your wallet to access verification tools.</CardContent></Card>
            </div>
        );
    }

    const currentQuest = quests.find(q => q.id === selectedQuestId);

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <Header pageTitle="Manual Quest Verification" />

            {pageError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Error!</strong>
                    <span className="block sm:inline ml-2">{pageError}</span>
                </div>
            )}

            {/* Quest Selector and Stats */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" /> Pending Reviews
                    </CardTitle>
                    <CardDescription>
                        Select a quest to review manual proofs submitted by users.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Select
                            value={selectedQuestId || undefined}
                            onValueChange={setSelectedQuestId}
                            disabled={quests.length === 0}
                        >
                            <SelectTrigger className="w-[300px]">
                                <SelectValue placeholder="Select a Quest Campaign" />
                            </SelectTrigger>
                            <SelectContent>
                                {quests.length === 0 ? (
                                    <SelectItem value="none" disabled>No quests requiring manual review found.</SelectItem>
                                ) : (
                                    quests.map(quest => (
                                        <SelectItem key={quest.id} value={quest.id}>
                                            {quest.title}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <Button onClick={fetchSubmissions} disabled={!selectedQuestId || isSubmissionsLoading}>
                            {isSubmissionsLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Eye className="h-4 w-4 mr-2" />
                            )}
                            Refresh Submissions
                        </Button>
                    </div>
                    {currentQuest && (
                         <div className="text-sm text-muted-foreground mt-2">
                             Faucet Address: <Badge variant="outline">{currentQuest.faucetAddress.slice(0, 6)}...{currentQuest.faucetAddress.slice(-4)}</Badge>
                         </div>
                    )}
                </CardContent>
            </Card>

            {/* Submissions List */}
            <Card>
                <CardHeader>
                    <CardTitle>Submissions ({submissions.length})</CardTitle>
                    <CardDescription>
                        Review and act on proofs for **{currentQuest?.title || 'Selected Quest'}.**
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isSubmissionsLoading && submissions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            Fetching pending submissions...
                        </div>
                    ) : submissions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            ✅ No pending manual submissions found for this quest.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {submissions.map((submission) => (
                                <div
                                    key={submission.id}
                                    className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-950"
                                >
                                    <div className="space-y-1 w-2/3">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold">{submission.taskTitle}</h4>
                                            <Badge variant="secondary">{submission.proofType.replace('_', ' ')}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            User ID: **{submission.userId.slice(0, 6)}...{submission.userId.slice(-4)}**
                                        </p>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 break-words">
                                            Proof: {submission.proofData}
                                        </p>
                                        <div className="flex items-center gap-2 pt-1">
                                            {submission.proofType === 'manual_link' ? (
                                                <a 
                                                    href={submission.proofData} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="text-xs text-green-500 hover:underline flex items-center gap-1"
                                                >
                                                    <LinkIcon className="h-3 w-3" /> View Link Proof
                                                </a>
                                            ) : (
                                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                                    <Upload className="h-3 w-3" /> Uploaded File
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                        <Badge className="text-md bg-purple-600 hover:bg-purple-700">
                                            +{submission.points} Points
                                        </Badge>
                                        <div className="flex gap-2">
                                            <Button
                                                 className="bg-green-500 hover:bg-green-600"
                                                size="sm"
                                                onClick={() => handleVerification(submission.id, 'approved', submission.points)}
                                                disabled={isProcessing}
                                            >
                                                <Check className="h-4 w-4 mr-1" /> Approve
                                            </Button>
                                            <Button
                                                className="bg-red-500 hover:bg-red-600"
                                                size="sm"
                                                onClick={() => handleVerification(submission.id, 'rejected', 0)}
                                                disabled={isProcessing}
                                            >
                                                <X className="h-4 w-4 mr-1" /> Reject
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isProcessing && (
                                <div className="text-center text-sm text-yellow-600 mt-4">
                                    <Loader2 className="h-4 w-4 animate-spin mr-1 inline" /> Processing verification...
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}