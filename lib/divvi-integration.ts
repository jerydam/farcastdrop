// Fixed Divvi Integration - handles different export patterns

// Try different import patterns
let getReferralTag: any = null;
let submitReferral: any = null;
let importError: string | null = null;

try {
  // Method 1: Named imports (most common)
  const namedImports = require("@divvi/referral-sdk");
  console.log("Divvi SDK named imports:", namedImports);
  console.log("Available keys:", Object.keys(namedImports));
  
  if (namedImports.getReferralTag && typeof namedImports.getReferralTag === 'function') {
    getReferralTag = namedImports.getReferralTag;
    console.log("✅ getReferralTag loaded from named imports");
  }
  
  if (namedImports.submitReferral && typeof namedImports.submitReferral === 'function') {
    submitReferral = namedImports.submitReferral;
    console.log("✅ submitReferral loaded from named imports");
  }
  
  // Method 2: Check default export if named imports didn't work
  if ((!getReferralTag || !submitReferral) && namedImports.default) {
    console.log("Checking default export:", namedImports.default);
    console.log("Default export keys:", Object.keys(namedImports.default));
    
    if (!getReferralTag && namedImports.default.getReferralTag) {
      getReferralTag = namedImports.default.getReferralTag;
      console.log("✅ getReferralTag loaded from default export");
    }
    
    if (!submitReferral && namedImports.default.submitReferral) {
      submitReferral = namedImports.default.submitReferral;
      console.log("✅ submitReferral loaded from default export");
    }
  }
  
  // Method 3: Check if the entire default export is the function
  if (!getReferralTag && typeof namedImports.default === 'function') {
    // Sometimes the default export is the main function
    getReferralTag = namedImports.default;
    console.log("✅ Using default export as getReferralTag");
  }
  
} catch (error) {
  console.error("Failed to import Divvi SDK:", error);
  importError = error.message;
}

// Final validation
if (!getReferralTag) {
  console.error("❌ getReferralTag not available");
  importError = importError || "getReferralTag function not found";
}

if (!submitReferral) {
  console.error("❌ submitReferral not available");
  importError = importError || "submitReferral function not found";
}

if (getReferralTag && submitReferral) {
  console.log("✅ Divvi SDK successfully loaded");
}

// Your Divvi Identifier from the integration guide
const DIVVI_CONSUMER_ADDRESS: `0x${string}` = "0xd59B83De618561c8FF4E98fC29a1b96ABcBFB18a";

/**
 * Appends Divvi referral data to transaction data
 * @param originalData - The original transaction data
 * @param userAddress - The address of the user making the transaction
 * @returns The transaction data with Divvi referral tag
 */
export function appendDivviReferralData(originalData: string, userAddress?: `0x${string}`): string {
  console.log("appendDivviReferralData called with:", { 
    originalDataLength: originalData.length, 
    userAddress,
    hasGetReferralTag: !!getReferralTag,
    importError
  });

  // If there's an import error, return original data
  if (importError) {
    console.warn("Divvi SDK not available, returning original data:", importError);
    return originalData;
  }

  // If no user address provided, return original data
  if (!userAddress) {
    console.warn("No user address provided for Divvi referral tag, returning original data");
    return originalData;
  }

  // If getReferralTag is not available, return original data
  if (!getReferralTag || typeof getReferralTag !== 'function') {
    console.warn("getReferralTag not available, returning original data");
    return originalData;
  }

  try {
    console.log("Generating Divvi referral tag for user:", userAddress);
    
    const referralTag = getReferralTag({
      user: userAddress,
      consumer: DIVVI_CONSUMER_ADDRESS,
    });

    console.log("Generated Divvi referral tag:", { 
      tagLength: referralTag?.length, 
      tagPreview: referralTag?.substring(0, 20) + "..." 
    });

    return originalData + referralTag;
  } catch (error) {
    console.error("Failed to generate Divvi referral tag:", error);
    return originalData; // Return original data if Divvi fails
  }
}

/**
 * Reports a successful transaction to Divvi
 * @param txHash - The transaction hash
 * @param chainId - The chain ID where the transaction was executed
 */
export async function reportTransactionToDivvi(txHash: `0x${string}`, chainId: number): Promise<void> {
  // If there's an import error, skip reporting
  if (importError) {
    console.warn("Skipping Divvi transaction reporting due to import error:", importError);
    return;
  }

  // If submitReferral is not available, skip reporting
  if (!submitReferral || typeof submitReferral !== 'function') {
    console.warn("submitReferral not available, skipping transaction reporting");
    return;
  }

  try {
    console.log(`Reporting transaction ${txHash} on chain ${chainId} to Divvi`);
    
    await submitReferral({
      txHash,
      chainId,
    });
    
    console.log("Successfully reported transaction to Divvi");
  } catch (error) {
    console.error("Failed to report transaction to Divvi:", error);
    // Don't throw the error to avoid breaking the main flow
  }
}

/**
 * Checks if the current network is supported by Divvi
 * @param chainId - The chain ID to check
 * @returns True if the network is supported, false otherwise
 */
export function isSupportedNetwork(chainId: number): boolean {
  return [1, 42220, 44787, 62320, 1135, 4202, 8453, 84532, 137].includes(chainId);
}

/**
 * Debug function to check Divvi SDK status
 */
export function getDivviStatus() {
  return {
    isSDKLoaded: !importError,
    importError,
    hasGetReferralTag: !!getReferralTag,
    hasSubmitReferral: !!submitReferral,
    getReferralTagType: typeof getReferralTag,
    submitReferralType: typeof submitReferral,
    consumerAddress: DIVVI_CONSUMER_ADDRESS,
  };
}

// Export the raw functions for debugging
export { getReferralTag as _getReferralTag, submitReferral as _submitReferral };