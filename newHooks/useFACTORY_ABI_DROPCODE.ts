import {
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from "wagmi";
import { FACTORY_ABI_DROPCODE } from "@/lib/abis"; // Import your existing ABI

// Type definitions for better TypeScript support
export interface FaucetDetails {
  faucetAddress: string;
  owner: string;
  name: string;
  claimAmount: bigint;
  tokenAddress: string;
  startTime: bigint;
  endTime: bigint;
  isClaimActive: boolean;
  balance: bigint;
  isEther: boolean;
  useBackend: boolean;
}

export interface Transaction {
  faucetAddress: string;
  transactionType: string;
  initiator: string;
  amount: bigint;
  isEther: boolean;
  timestamp: bigint;
}

// ============================================
// GETTER HOOKS (Read Functions)
// ============================================

export const USE_FACTORY_ABI_DROPCODE = () => {
  const useGetAllFaucets = (contractAddress: `0x${string}`) => {
    return useReadContract({
      address: contractAddress,
      abi: FACTORY_ABI_DROPCODE,
      functionName: "getAllFaucets",
    });
  };

  const useGetAllTransactions = (contractAddress: `0x${string}`) => {
    return useReadContract({
      address: contractAddress,
      abi: FACTORY_ABI_DROPCODE,
      functionName: "getAllTransactions",
    });
  };

  const useGetFaucetDetails = (
    contractAddress: `0x${string}`,
    faucetAddress: `0x${string}`
  ) => {
    return useReadContract({
      address: contractAddress,
      abi: FACTORY_ABI_DROPCODE,
      functionName: "getFaucetDetails",
      args: [faucetAddress],
    });
  };

  const useGetFaucetTransactions = (
    contractAddress: `0x${string}`,
    faucetAddress: `0x${string}`
  ) => {
    return useReadContract({
      address: contractAddress,
      abi: FACTORY_ABI_DROPCODE,
      functionName: "getFaucetTransactions",
      args: [faucetAddress],
    });
  };

  const useGetOwner = (contractAddress: `0x${string}`) => {
    return useReadContract({
      address: contractAddress,
      abi: FACTORY_ABI_DROPCODE,
      functionName: "owner",
    });
  };

  // ============================================
  // SETTER HOOKS (Write Functions)
  // ============================================

  const useCreateBackendFaucet = () => {
    const { writeContract, ...rest } = useWriteContract();

    const createFaucet = (
      contractAddress: `0x${string}`,
      name: string,
      token: `0x${string}`,
      backend: `0x${string}`
    ) => {
      writeContract({
        address: contractAddress,
        abi: FACTORY_ABI_DROPCODE,
        functionName: "createBackendFaucet",
        args: [name, token, backend],
      });
    };

    return { createFaucet, ...rest };
  };

  const useRecordTransaction = () => {
    const { writeContract, ...rest } = useWriteContract();

    const recordTransaction = (
      contractAddress: `0x${string}`,
      faucetAddress: `0x${string}`,
      transactionType: string,
      initiator: `0x${string}`,
      amount: bigint,
      isEther: boolean
    ) => {
      writeContract({
        address: contractAddress,
        abi: FACTORY_ABI_DROPCODE,
        functionName: "recordTransaction",
        args: [faucetAddress, transactionType, initiator, amount, isEther],
      });
    };

    return { recordTransaction, ...rest };
  };

  const useRenounceOwnership = () => {
    const { writeContract, ...rest } = useWriteContract();

    const renounceOwnership = (contractAddress: `0x${string}`) => {
      writeContract({
        address: contractAddress,
        abi: FACTORY_ABI_DROPCODE,
        functionName: "renounceOwnership",
      });
    };

    return { renounceOwnership, ...rest };
  };

  const useTransferOwnership = () => {
    const { writeContract, ...rest } = useWriteContract();

    const transferOwnership = (
      contractAddress: `0x${string}`,
      newOwner: `0x${string}`
    ) => {
      writeContract({
        address: contractAddress,
        abi: FACTORY_ABI_DROPCODE,
        functionName: "transferOwnership",
        args: [newOwner],
      });
    };

    return { transferOwnership, ...rest };
  };

  // ============================================
  // EVENT HOOKS (Watch Contract Events)
  // ============================================

  const useWatchFaucetCreated = (
    contractAddress: `0x${string}`,
    onLogs: (logs: any[]) => void
  ) => {
    useWatchContractEvent({
      address: contractAddress,
      abi: FACTORY_ABI_DROPCODE,
      eventName: "FaucetCreated",
      onLogs,
    });
  };

  const useWatchOwnershipTransferred = (
    contractAddress: `0x${string}`,
    onLogs: (logs: any[]) => void
  ) => {
    useWatchContractEvent({
      address: contractAddress,
      abi: FACTORY_ABI_DROPCODE,
      eventName: "OwnershipTransferred",
      onLogs,
    });
  };

  const useWatchTransactionRecorded = (
    contractAddress: `0x${string}`,
    onLogs: (logs: any[]) => void
  ) => {
    useWatchContractEvent({
      address: contractAddress,
      abi: FACTORY_ABI_DROPCODE,
      eventName: "TransactionRecorded",
      onLogs,
    });
  };

  return {
    // ============================================
    // GETTER HOOKS (Read Functions)
    // ============================================
    useGetAllFaucets,
    useGetAllTransactions,
    useGetFaucetDetails,
    useGetFaucetTransactions,
    useGetOwner,

    // ============================================
    // SETTER HOOKS (Write Functions)
    // ============================================
    useCreateBackendFaucet,
    useRecordTransaction,
    useRenounceOwnership,
    useTransferOwnership,

    // ============================================
    // EVENT HOOKS (Watch Contract Events)
    // ============================================
    useWatchFaucetCreated,
    useWatchOwnershipTransferred,
    useWatchTransactionRecorded,
  };
};

// ============================================
// USAGE EXAMPLE
// ============================================

/*
import { useGetAllFaucets, useCreateBackendFaucet } from './hooks';

function MyComponent() {
  const CONTRACT_ADDRESS = '0x...';
  
  // Read data
  const { data: faucets, isLoading } = useGetAllFaucets(CONTRACT_ADDRESS);
  
  // Write data
  const { createFaucet, isPending, isSuccess } = useCreateBackendFaucet();
  
  const handleCreate = () => {
    createFaucet(
      CONTRACT_ADDRESS,
      'My Faucet',
      '0x...', // token address
      '0x...'  // backend address
    );
  };
  
  return (
    <div>
      <button onClick={handleCreate} disabled={isPending}>
        Create Faucet
      </button>
      {faucets?.map(address => <div key={address}>{address}</div>)}
    </div>
  );
}
*/
