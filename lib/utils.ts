import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { useToast } from "@/hooks/use-toast" // This is likely your UI hook, keep it.

// Helper to get the window object safely in Next.js/React
const getEthereum = () => {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return (window as any).ethereum;
  }
  return null;
}

export const ensureCorrectNetwork = async (requiredChainId: number): Promise<boolean> => {
  const ethereum = getEthereum();
  // We can't use the hook 'useToast' inside a regular function.
  // We have to rely on the calling component to handle the toast, 
  // OR we can return an error object/string.
  // However, for this fix, I will assume you pass the 'toast' function IN as an argument
  // to keep it pure, or we handle the UI error in the return value.
  
  // OPTION: Pass toast as an argument or handle errors where you call this.
  // For this example, I will return false and log the error, 
  // but see the note below on how to fix the toast.

  if (!ethereum) {
    console.error("No wallet found");
    return false;
  }

  try {
    const currentChainIdHex = await ethereum.request({ method: 'eth_chainId' });
    const currentChainId = parseInt(currentChainIdHex, 16);

    if (currentChainId === requiredChainId) {
      return true;
    }

    // Convert number to hex (e.g., 84532 -> 0x14a34)
    const requiredChainIdHex = `0x${requiredChainId.toString(16)}`;

    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: requiredChainIdHex }],
    });

    return true;

  } catch (error: any) {
    // Error code 4902 means the chain has not been added to the wallet
    if (error.code === 4902) {
      console.error("Chain not found in wallet. You need to add it via wallet_addEthereumChain");
    } else {
      console.error("Failed to switch network", error);
    }
    return false;
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}