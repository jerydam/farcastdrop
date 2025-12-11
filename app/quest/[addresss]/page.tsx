// src/pages/quests/[faucetAddress].tsx (or components/QuestDetailsPage.tsx)

"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from '@/components/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle, Clock, Save, TrendingUp, Users, ArrowRight } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { useNetwork } from '@/hooks/use-network'; 

// Backend API URL
const API_BASE_URL = "https://fauctdrop-backend.onrender.com";

// --- Data Structures ---
interface QuestData {
    title: string;
    description: string;
    faucetAddress: string;
    isActive: boolean;
    tasks: any[]; 
    creatorAddress: string; 
}

interface LeaderboardEntry {
    rank: number;
    walletAddress: string;
    points: number;
    completedTasks: number;
}

interface Submission {
    submissionId: string;
    walletAddress: string;
    taskId: string;
    taskTitle: string;
    submittedData: string; 
    submissionType: 'manual_link' | 'manual_upload' | 'auto_tx';
    status: 'pending' | 'approved' | 'rejected';
}

export default function QuestDetailsPage() {
    const params = useParams();
    // Get parameter from route. Can be string | string[] | undefined.
    const slugAndId = params.faucetAddress as string | undefined; 
    
    // FIX 1: Safely extract faucetAddress. It remains string | undefined.
    // NOTE: This logic now expects slug-address format, matching the updated HomePage logic.
    const faucetAddress: string | undefined = slugAndId?.split('-').pop()?.startsWith('0x') ? slugAndId.split('-').pop() : undefined;

    const { address: userWalletAddress } = useWallet(); 
    const { network, chainId } = useNetwork(); 
    
    const [questData, setQuestData] = useState<QuestData | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Data Fetching ---

    useEffect(() => {
        // FIX 2: Check for existence of faucetAddress before fetching.
        if (!faucetAddress) {
            if (slugAndId) { // Route is defined but address is invalid/not found
                setError("Invalid Quest URL format or Faucet Address not found in the path.");
                setIsLoading(false);
            }
            return;
        }
        fetchQuestData();
        fetchLeaderboard();
        fetchPendingSubmissions(); 
    }, [faucetAddress, slugAndId]); // Re-run if faucetAddress becomes defined

    const fetchQuestData = async () => {
        // FIX 3: Use non-null assertion (!) since we checked for 'undefined' in useEffect.
        const address = faucetAddress!; 
        setIsLoading(true); // Reset loading state for every fetch attempt
        setError(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); 
            
            const mockData: QuestData = {
                title: "Launch Community Campaign",
                // FIX: Use optional chaining when displaying the address slice, though it should be safe here
                description: `Manage the activity and rewards for ${address.slice(0, 8)}...`, 
                faucetAddress: address,
                isActive: true,
                tasks: [{ id: 't1', title: 'Follow on X', verificationType: 'auto_social' }, { id: 't2', title: 'Submit Meme Link', verificationType: 'manual_link' }],
                creatorAddress: "0xMockCreatorAddress1234567890",
            };
            setQuestData(mockData);
        } catch (err: any) {
            setError(err.message || "An unknown error occurred while fetching data.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLeaderboard = async () => { /* ... existing implementation ... */ 
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const mockLeaderboard: LeaderboardEntry[] = [
                { rank: 1, walletAddress: "0x123...abc", points: 1200, completedTasks: 6 },
                { rank: 2, walletAddress: "0x456...def", points: 1100, completedTasks: 5 },
                { rank: 3, walletAddress: "0x789...ghi", points: 950, completedTasks: 5 },
            ];
            setLeaderboard(mockLeaderboard);
        } catch (err: any) {
            console.error("Leaderboard fetch failed:", err);
        }
    };
    
    const fetchPendingSubmissions = async () => { /* ... existing implementation ... */
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const mockSubmissions: Submission[] = [
                { submissionId: 's1', walletAddress: "0x123...abc", taskId: 't2', taskTitle: 'Submit Meme Link', submittedData: 'http://link.to/meme', submissionType: 'manual_link', status: 'pending' },
                { submissionId: 's2', walletAddress: "0x456...def", taskId: 't2', taskTitle: 'Submit Meme Link', submittedData: 'http://link.to/another', submissionType: 'manual_link', status: 'pending' },
            ];
            setPendingSubmissions(mockSubmissions);
        } catch (err: any) {
            console.error("Submissions fetch failed:", err);
        }
    }

    // --- Admin Action Handlers ---
    // FIX 4: Use optional chaining (?) for safe access to questData properties.
    const isCreator = userWalletAddress && questData && questData.creatorAddress.toLowerCase() === userWalletAddress.toLowerCase();

    const handleApprove = async (submissionId: string) => {
        if (!isCreator) return;
        console.log(`Approving submission ${submissionId}`);
        setPendingSubmissions(p => p.filter(s => s.submissionId !== submissionId));
    };

    const handleReject = async (submissionId: string) => {
        if (!isCreator) return;
        console.log(`Rejecting submission ${submissionId}`);
        setPendingSubmissions(p => p.filter(s => s.submissionId !== submissionId));
    };

    const handleFinalizeRewards = () => {
        if (!isCreator) return;
        alert("Reward Finalization Triggered! (Requires Manual Reward Allocation UI)");
    }

    // --- Render ---

    if (isLoading || !faucetAddress) {
        // Show loading or error if address is not available
        if (error) {
            return <Card className="max-w-6xl mx-auto p-4 mt-8 border-red-500 bg-red-50 text-red-700">Error loading quest: {error}</Card>;
        }
         if (!questData && !isLoading) { // Handles case where data loaded null/404
             return <Card className="max-w-6xl mx-auto p-4 mt-8 text-center text-muted-foreground">Quest data could not be loaded or found.</Card>;
        }
        return <Card className="max-w-6xl mx-auto p-8 mt-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading Quest Details...</Card>;
    }
    
    // Non-null assertion (!) is now safe here because of the checks above
    const tasksCount = questData!.tasks.length;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* FIX 1: Add ! assertion */}
            <Header pageTitle={questData!.title} />

            <Card>
                <CardHeader className='flex flex-row justify-between items-start'>
                    <div className='space-y-1'>
                        {/* FIX 2: Add ! assertion */}
                        <CardTitle className="text-2xl">{questData!.title}</CardTitle>
                        {/* FIX 3: Add ! assertion */}
                        <CardDescription>{questData!.description}</CardDescription>
                    </div>
                    {isCreator && (
                        <Button onClick={handleFinalizeRewards} className='bg-purple-600 hover:bg-purple-700'>
                            <Save className='h-4 w-4 mr-2' /> Finalize Rewards & Payout
                        </Button>
                    )}
                </CardHeader>
            </Card>

            <Tabs defaultValue="activity">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="activity">Activity & Submissions</TabsTrigger>
                    <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                {/* --- ACTIVITY & SUBMISSIONS TAB --- */}
                <TabsContent value="activity" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className='h-5 w-5' /> Pending Manual Verification ({pendingSubmissions.length})
                            </CardTitle>
                            <CardDescription>Review user submissions for manual verification tasks.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Wallet</TableHead>
                                        <TableHead>Task</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Submission</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingSubmissions.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No pending manual submissions found.</TableCell></TableRow>
                                    ) : (
                                        pendingSubmissions.map(submission => (
                                            <TableRow key={submission.submissionId}>
                                                <TableCell className='font-mono text-xs'>{submission.walletAddress.slice(0, 6)}...</TableCell>
                                                <TableCell>{submission.taskTitle}</TableCell>
                                                <TableCell>{submission.submissionType.replace('_', ' ')}</TableCell>
                                                <TableCell>
                                                    <a href={submission.submittedData} target="_blank" rel="noopener noreferrer" className='text-blue-500 hover:underline flex items-center'>
                                                        View Link <ArrowRight className='h-3 w-3 ml-1' />
                                                    </a>
                                                </TableCell>
                                                <TableCell className='space-x-2'>
                                                    <Button size="sm" variant="default" onClick={() => handleApprove(submission.submissionId)}>Approve</Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleReject(submission.submissionId)}>Reject</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- LEADERBOARD TAB --- */}
                <TabsContent value="leaderboard" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className='h-5 w-5' /> Quest Leaderboard
                            </CardTitle>
                            <CardDescription>Top users ranked by earned points.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Rank</TableHead>
                                        <TableHead>Wallet Address</TableHead>
                                        <TableHead>Points</TableHead>
                                        <TableHead>Tasks Completed</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {leaderboard.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No activity yet. Be the first!</TableCell></TableRow>
                                    ) : (
                                        leaderboard.map((entry, index) => (
                                            <TableRow key={entry.walletAddress} className={index < 3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10 font-semibold' : ''}>
                                                <TableCell>{entry.rank}</TableCell>
                                                <TableCell className='font-mono text-xs'>{entry.walletAddress.slice(0, 10)}...{entry.walletAddress.slice(-8)}</TableCell>
                                                <TableCell>{entry.points}</TableCell>
                                                <TableCell>{entry.completedTasks} / {tasksCount}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- SETTINGS TAB --- */}
                <TabsContent value="settings" className="mt-4">
                    <Card><CardHeader><CardTitle>Quest Configuration</CardTitle><CardDescription>View and modify deployment parameters.</CardDescription></CardHeader>
                        <CardContent className='space-y-4 text-sm'>
                            <p><strong>Faucet Address:</strong> <span className='font-mono'>{faucetAddress}</span></p>
                            <p>
                                <strong>Deployment Chain:</strong> {network?.name || 'Unknown'} (ID: {chainId})
                            </p>
                            <p>
                                <strong>Active:</strong> 
                                {/* FIX 4: Add ! assertion */}
                                {questData!.isActive 
                                    ? <CheckCircle className='h-4 w-4 inline text-green-500 ml-2' /> 
                                    : 'No'
                                }
                            </p>
                            <Button variant="outline" onClick={() => {/* Edit logic */}}>Edit Quest Details</Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}