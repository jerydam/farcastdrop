import { BrowserProvider } from 'ethers';
import { appendDivviReferralData, reportTransactionToDivvi } from './divvi-integration';
import { FAUCET_ABI_CUSTOM } from './abis';

//const API_URL = "https://fauctdrop-backend.onrender.com"; // Update with your backend URL
const API_URL = "https://fauctdrop-backend.onrender.com"; // Uncomment for production
const ENABLE_DIVVI_REFERRAL = true;
const DEBUG_MODE = process.env.NODE_ENV === 'development';

interface ClaimPayload {
  userAddress: string;
  faucetAddress: string;
  chainId: number;
  secretCode?: string;
  divviReferralData?: string;
}

interface DivviIntegrationResult {
  isApplicable: boolean;
  isWorking: boolean;
  data?: string;
  error?: string;
  debugInfo?: any;
}

interface RequestLogData {
  userAddress: string;
  faucetAddress: string;
  chainId: number;
  hasDivviData: boolean;
  divviDataLength: number;
  timestamp: string;
  payload?: string;
  divviDebugInfo?: any;
}

interface DebugInfo {
  chainId: number;
  isSupportedNetwork: boolean;
  enabled: boolean;
  timestamp: string;
  reason?: string;
  rawData?: {
    value: string;
    type: string;
    length: number;
    isEmpty: boolean;
  };
  validation?: {
    isValid: boolean;
    fixed: string;
    error?: string;
  };
  processedData?: string;
  errorType?: string;
  errorMessage?: string;
}

interface SecretCodeData {
  faucet_address: string;
  secret_code: string;
  start_time: number;
  end_time: number;
  is_valid: boolean;
  is_expired: boolean;
  is_future: boolean;
  created_at?: string;
  time_remaining: number;
}

// Unified supported networks - matches Divvi supported networks

// AFTER (Fixed - includes 42161):
const SUPPORTED_CHAIN_IDS = [
  1,      // Ethereum Mainnet
  42220,  // Celo Mainnet  
  44787,  // Celo Testnet
  62320,  // Custom Network
  1135,   // Lisk
  4202,   // Lisk Testnet
  8453,   // Base
  84532,  // Base Testnet
  42161,  // Arbitrum One (ADDED - THIS WAS MISSING!)
  421614, // Arbitrum Sepolia
  137,    // Polygon Mainnet
];

// Optional: chains where Divvi should be disabled even if technically supported
const DIVVI_DISABLED_CHAINS: number[] = [
  // Add any specific chain IDs where you want to disable Divvi
];

function isSupportedNetwork(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

// Helper function to check if Divvi should be used for the current chain
export function shouldUseDivvi(chainId: number): boolean {
  if (!ENABLE_DIVVI_REFERRAL) {
    return false;
  }
  
  if (!isSupportedNetwork(chainId)) {
    return false;
  }
  
  if (DIVVI_DISABLED_CHAINS.includes(chainId)) {
    debugLog(`Divvi disabled for specific chain: ${chainId}`);
    return false;
  }
  
  return true;
}

function debugLog(message: string, data?: any) {
  if (DEBUG_MODE) {
    console.log(`🔍 [Divvi Debug] ${message}`, data ? data : '');
  }
}

function errorLog(message: string, error?: any) {
  console.error(`❌ [Divvi Error] ${message}`, error ? error : '');
}

function successLog(message: string, data?: any) {
  console.log(`✅ [Divvi Success] ${message}`, data ? data : '');
}

function validateAndFixHexData(data: string): { isValid: boolean; fixed: string; error?: string } {
  if (!data || typeof data !== 'string') {
    return { isValid: false, fixed: '', error: 'Data is empty or not a string' };
  }

  const trimmed = data.trim();
  if (trimmed === '') {
    return { isValid: false, fixed: '', error: 'Data is empty after trimming' };
  }

  const hexPattern = /^(0x)?[0-9a-fA-F]+$/;
  if (!hexPattern.test(trimmed)) {
    return { isValid: false, fixed: '', error: 'Data contains non-hex characters' };
  }

  const fixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  
  const hexPart = fixed.slice(2);
  if (hexPart.length % 2 !== 0) {
    return { isValid: false, fixed: '', error: 'Hex data has odd length (incomplete bytes)' };
  }

  return { isValid: true, fixed };
}

// Helper function to safely get network with retry logic
async function safeGetNetwork(provider: BrowserProvider, maxRetries: number = 3): Promise<{ chainId: number }> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      debugLog(`Attempting to get network (attempt ${attempt}/${maxRetries})`);
      
      // Add a small delay between retries to allow network to stabilize
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      
      successLog(`Successfully got network on attempt ${attempt}`, { chainId });
      return { chainId };
      
    } catch (error) {
      lastError = error as Error;
      errorLog(`Network fetch attempt ${attempt} failed`, error);
      
      // If it's a network change error, try to create a fresh provider
      if (error.message.includes('network changed') && attempt < maxRetries) {
        debugLog('Network change detected, will retry with delay');
        continue;
      }
      
      // For other errors, don't retry
      if (!error.message.includes('network changed')) {
        throw error;
      }
    }
  }
  
  // If all retries failed, throw the last error
  throw new Error(`Failed to get network after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

// Alternative approach: Get chainId directly from ethereum provider
async function getChainIdFromWindow(): Promise<number | null> {
  try {
    if (typeof window !== 'undefined' && window.ethereum) {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      return parseInt(chainId, 16);
    }
  } catch (error) {
    debugLog('Failed to get chainId from window.ethereum', error);
  }
  return null;
}

// Robust network detection function
async function getRobustChainId(provider: BrowserProvider): Promise<number> {
  try {
    // First try the direct window.ethereum approach
    const windowChainId = await getChainIdFromWindow();
    if (windowChainId) {
      debugLog('Got chainId from window.ethereum', { chainId: windowChainId });
      return windowChainId;
    }
  } catch (error) {
    debugLog('Window ethereum approach failed, falling back to provider', error);
  }
  
  // Fallback to provider with retry logic
  const network = await safeGetNetwork(provider);
  return network.chainId;
}

async function processDivviReferralData(chainId: number, userAddress: string): Promise<{
  data?: string;
  error?: string;
  debugInfo: DebugInfo;
}> {
  const debugInfo: DebugInfo = {
    chainId,
    isSupportedNetwork: isSupportedNetwork(chainId),
    enabled: ENABLE_DIVVI_REFERRAL,
    timestamp: new Date().toISOString()
  };

  // Early return if Divvi is disabled globally
  if (!ENABLE_DIVVI_REFERRAL) {
    debugLog('Divvi referral is disabled globally');
    return { debugInfo: { ...debugInfo, reason: 'disabled' } };
  }

  // Early return if network is not supported by Divvi
  if (!isSupportedNetwork(chainId)) {
    debugLog(`Network not supported by Divvi (chainId: ${chainId}). Bypassing Divvi integration.`);
    return { 
      debugInfo: { 
        ...debugInfo, 
        reason: 'unsupported_network'
      } 
    };
  }

  // Early return if chain is specifically disabled
  if (DIVVI_DISABLED_CHAINS.includes(chainId)) {
    debugLog(`Divvi disabled for specific chain: ${chainId}`);
    return { debugInfo: { ...debugInfo, reason: 'chain_disabled' } };
  }

  // Early return if no user address
  if (!userAddress) {
    debugLog('No user address provided for Divvi referral');
    return { debugInfo: { ...debugInfo, reason: 'no_user_address' } };
  }

  try {
    debugLog('Attempting to get Divvi referral data...', { userAddress, chainId });
    
    // Updated to use v2 API which requires user address
    const rawData = appendDivviReferralData('', userAddress as `0x${string}`);
    
    debugInfo.rawData = {
      value: rawData,
      type: typeof rawData,
      length: rawData?.length || 0,
      isEmpty: !rawData || rawData.trim() === ''
    };

    debugLog('Raw Divvi data received:', debugInfo.rawData);

    if (!rawData || rawData.trim() === '') {
      const error = 'appendDivviReferralData returned empty or null data';
      debugLog(error);
      return { error, debugInfo: { ...debugInfo, reason: 'empty_data' } };
    }

    const validation = validateAndFixHexData(rawData);
    debugInfo.validation = validation;

    if (!validation.isValid) {
      const error = `Invalid hex data: ${validation.error}`;
      errorLog(error, { rawData, validation });
      return { error, debugInfo: { ...debugInfo, reason: 'invalid_hex' } };
    }

    successLog('Successfully processed Divvi referral data', {
      userAddress,
      chainId,
      original: rawData,
      fixed: validation.fixed,
      length: validation.fixed.length
    });

    return {
      data: validation.fixed,
      debugInfo: { ...debugInfo, reason: 'success', processedData: validation.fixed }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errorLog('Failed to process Divvi referral data', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    
    return {
      error: errorMessage,
      debugInfo: {
        ...debugInfo,
        reason: 'exception',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage
      }
    };
  }
}

async function reportToDivvi(txHash: string, chainId: number): Promise<void> {
  // Skip reporting if Divvi should not be used for this chain
  if (!shouldUseDivvi(chainId)) {
    debugLog(`Skipping Divvi reporting - ${!ENABLE_DIVVI_REFERRAL ? 'disabled globally' : 'unsupported chain'} (chainId: ${chainId})`);
    return;
  }

  try {
    debugLog(`Reporting transaction to Divvi: ${txHash} on chain ${chainId}`);
    await reportTransactionToDivvi(txHash as `0x${string}`, chainId);
    successLog('Transaction reported to Divvi successfully');
  } catch (error) {
    errorLog('Failed to report transaction to Divvi', error);
    
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error(`
🚫 CORS Error Detected - Transaction reporting to Divvi failed
📋 Error Details:
   - This is a Cross-Origin Resource Sharing (CORS) issue
   - The Divvi API doesn't allow requests from your current domain
   - Your main transaction was still successful!

💡 Recommended Solutions:
   1. Move Divvi reporting to your backend server (recommended)
   2. Contact Divvi support to allowlist your domain
   3. Use a proxy server for development
   4. Skip Divvi reporting in development mode

🔧 Quick Fix for Development:
   Set ENABLE_DIVVI_REFERRAL=false or add domain check
      `);
    }
  }
}

// Secret Code Retrieval Functions
export async function retrieveSecretCode(faucetAddress: string): Promise<string> {
  try {
    console.log(`🔍 Retrieving secret code for faucet: ${faucetAddress}`);
    
    const response = await fetch(`${API_URL}/secret-code/${faucetAddress}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { 
          detail: `Failed to parse backend response. Status: ${response.status} ${response.statusText}` 
        };
      }
      
      if (response.status === 404) {
        throw new Error(`No secret code found for this faucet address`);
      }
      
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `Failed to retrieve secret code (${response.status}): ${JSON.stringify(errorData)}`
      );
    }

    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('Invalid response format from server');
    }

    const secretData: SecretCodeData = result.data;
    
    console.log(`✅ Secret code retrieved:`, {
      code: secretData.secret_code,
      isValid: secretData.is_valid,
      isExpired: secretData.is_expired,
      timeRemaining: secretData.time_remaining
    });

    if (secretData.is_expired) {
      throw new Error(`Secret code has expired`);
    }

    if (secretData.is_future) {
      throw new Error(`Secret code is not yet active`);
    }

    if (!secretData.is_valid) {
      throw new Error(`Secret code is not currently valid`);
    }

    return secretData.secret_code;
    
  } catch (error) {
    console.error('❌ Error retrieving secret code:', error);
    throw error;
  }
}

export async function getAllSecretCodes(): Promise<SecretCodeData[]> {
  try {
    console.log('🔍 Retrieving all secret codes...');
    
    const response = await fetch(`${API_URL}/secret-codes`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { 
          detail: `Failed to parse backend response. Status: ${response.status} ${response.statusText}` 
        };
      }
      
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `Failed to retrieve secret codes (${response.status}): ${JSON.stringify(errorData)}`
      );
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Invalid response format from server');
    }

    console.log(`✅ Retrieved ${result.count} secret codes`);
    return result.codes || [];
    
  } catch (error) {
    console.error('❌ Error retrieving all secret codes:', error);
    throw error;
  }
}

export async function getValidSecretCodes(): Promise<SecretCodeData[]> {
  try {
    console.log('🔍 Retrieving valid secret codes...');
    
    const response = await fetch(`${API_URL}/secret-codes/valid`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { 
          detail: `Failed to parse backend response. Status: ${response.status} ${response.statusText}` 
        };
      }
      
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `Failed to retrieve valid secret codes (${response.status}): ${JSON.stringify(errorData)}`
      );
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Invalid response format from server');
    }

    console.log(`✅ Retrieved ${result.count} valid secret codes`);
    return result.codes || [];
    
  } catch (error) {
    console.error('❌ Error retrieving valid secret codes:', error);
    throw error;
  }
}

// Storage helper functions for caching
export function getFromStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn('Failed to read from localStorage:', error);
    return null;
  }
}

export function setToStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Failed to write to localStorage:', error);
  }
}

export async function debugClaimRequest(
  userAddress: string,
  faucetAddress: string,
  secretCode: string,
  chainId: number
) {
  console.log('🔍 Debugging claim request parameters...');
  
  const validation = {
    userAddress: {
      value: userAddress,
      isValid: /^0x[a-fA-F0-9]{40}$/.test(userAddress),
      isEmpty: !userAddress,
      length: userAddress?.length
    },
    faucetAddress: {
      value: faucetAddress,
      isValid: /^0x[a-fA-F0-9]{40}$/.test(faucetAddress),
      isEmpty: !faucetAddress,
      length: faucetAddress?.length
    },
    secretCode: {
      value: secretCode,
      isValid: /^[A-Z0-9]{6}$/.test(secretCode || ''),
      isEmpty: !secretCode,
      length: secretCode?.length,
      pattern: secretCode ? secretCode.match(/^[A-Z0-9]{6}$/) : null
    },
    chainId: {
      value: chainId,
      isValid: SUPPORTED_CHAIN_IDS.includes(chainId),
      type: typeof chainId,
      validChains: SUPPORTED_CHAIN_IDS
    }
  };
  
  console.log('📊 Validation Results:', validation);
  
  const errors = [];
  if (!validation.userAddress.isValid) {
    errors.push(`Invalid userAddress: ${userAddress} (length: ${validation.userAddress.length})`);
  }
  if (!validation.faucetAddress.isValid) {
    errors.push(`Invalid faucetAddress: ${faucetAddress} (length: ${validation.faucetAddress.length})`);
  }
  if (!validation.secretCode.isValid) {
    errors.push(`Invalid secretCode: "${secretCode}" (length: ${validation.secretCode.length}, pattern match: ${validation.secretCode.pattern})`);
  }
  if (!validation.chainId.isValid) {
    errors.push(`Invalid chainId: ${chainId} (type: ${validation.chainId.type}, valid: ${validation.chainId.validChains})`);
  }
  
  if (errors.length > 0) {
    console.error('❌ Validation Errors Found:', errors);
    return { valid: false, errors };
  }
  
  console.log('✅ All parameters valid');
  return { valid: true, errors: [] };
}

export async function claimCustomViaBackend(
  userAddress: string,
  faucetAddress: string,
  provider: BrowserProvider
): Promise<{ success: boolean; txHash: string; divviDebug?: any }> {
  try {
    debugLog('Input to claimCustomViaBackend', {
      userAddress,
      faucetAddress
    });

    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error("Wallet not detected. Please install MetaMask or another Ethereum wallet in a supported browser.");
    }

    if (!provider) {
      throw new Error("Provider not initialized. Please ensure your wallet is connected.");
    }

    // Use robust network detection
    const chainId = await getRobustChainId(provider);

    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}. Please switch to a supported network: ${SUPPORTED_CHAIN_IDS.join(', ')}`);
    }

    debugLog(`Starting custom drop process for chainId: ${chainId}`);

    // Clean and validate addresses
    const cleanUserAddress = userAddress.trim();
    const cleanFaucetAddress = faucetAddress.trim();
    
    console.log('🧹 Cleaned parameters for custom claim:', {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId,
      divviSupported: shouldUseDivvi(chainId)
    });

    let payload = {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId
    };

    // Only process Divvi data if the chain is supported
    if (shouldUseDivvi(chainId)) {
      const divviResult = await processDivviReferralData(chainId, cleanUserAddress);
      
      if (divviResult.data) {
        payload.divviReferralData = divviResult.data;
        successLog('Added Divvi referral data to custom claim payload', { 
          length: divviResult.data.length,
          preview: `${divviResult.data.slice(0, 20)}...`
        });
      } else if (divviResult.error) {
        debugLog(`Proceeding without Divvi data: ${divviResult.error}`);
      }
    } else {
      debugLog(`Skipping Divvi integration for unsupported chain: ${chainId}`);
    }

    const requestLog: RequestLogData = {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId,
      hasDivviData: !!payload.divviReferralData,
      divviDataLength: payload.divviReferralData?.length || 0,
      timestamp: new Date().toISOString()
    };

    if (DEBUG_MODE) {
      requestLog.payload = JSON.stringify(payload, null, 2);
    }

    debugLog('Sending custom drop request', requestLog);

    const response = await fetch(`${API_URL}/claim-custom`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log('📥 Custom claim response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      const responseText = await response.text();
      
      console.log('📄 Raw custom claim response text:', responseText);
      
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Failed to parse custom claim error response as JSON:', e);
        errorData = { 
          detail: `Failed to parse backend response. Status: ${response.status} ${response.statusText}. Raw response: ${responseText}` 
        };
      }
      
      errorLog('Custom claim backend request failed', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        requestPayload: payload
      });
      
      // Handle specific error cases for custom claims
      if (response.status === 400) {
        const errorMessage = errorData.detail || errorData.message || 'Bad Request';
        
        if (errorMessage.includes('No custom claim amount')) {
          throw new Error(`No custom allocation found: You don't have a custom claim amount set for this faucet.`);
        } else if (errorMessage.includes('Custom claim amount is zero')) {
          throw new Error(`Invalid allocation: Your custom claim amount is set to zero.`);
        } else if (errorMessage.includes('already claimed')) {
          throw new Error(`Already claimed: You have already claimed your custom amount from this faucet.`);
        } else if (errorMessage.includes('Invalid address')) {
          throw new Error(`Address validation failed: ${errorMessage}`);
        } else if (errorMessage.includes('Insufficient funds')) {
          throw new Error(`Backend wallet has insufficient funds: ${errorMessage}`);
        } else if (errorMessage.includes('Faucet is paused')) {
          throw new Error(`Faucet is currently paused: ${errorMessage}`);
        } else {
          throw new Error(`Custom claim failed: ${errorMessage}`);
        }
      } else if (response.status === 500) {
        const errorMessage = errorData.detail || errorData.message || 'Internal Server Error';
        throw new Error(`Server error during custom claim: ${errorMessage}`);
      }
      
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `Custom claim backend request failed (${response.status}): ${JSON.stringify(errorData)}`
      );
    }

    const result = await response.json();
    successLog('Custom drop request successful', { 
      success: result.success, 
      txHash: result.txHash 
    });

    // Only report to Divvi if the chain is supported
    if (result.success && result.txHash && shouldUseDivvi(chainId)) {
      setTimeout(() => {
        reportToDivvi(result.txHash, chainId);
      }, 100);
    } else if (result.success && result.txHash) {
      debugLog(`Custom claim successful but not reporting to Divvi (unsupported chain: ${chainId})`);
    }

    if (DEBUG_MODE) {
      result.divviDebug = {
        chainSupported: shouldUseDivvi(chainId),
        divviUsed: !!payload.divviReferralData
      };
    }

    return result;
  } catch (error) {
    errorLog('Error in claimCustomViaBackend', error);
    console.error('❌ Comprehensive error in claimCustomViaBackend:', {
      error: error.message,
      stack: error.stack,
      userAddress,
      faucetAddress,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// Helper function to check if user has custom allocation
export async function checkCustomAllocation(
  userAddress: string,
  faucetAddress: string,
  provider: BrowserProvider
): Promise<{ hasAllocation: boolean; amount?: string; error?: string }> {
  try {
    debugLog('Checking custom allocation', { userAddress, faucetAddress });

    if (!provider) {
      throw new Error("Provider not initialized");
    }

    const chainId = await getRobustChainId(provider);

    // Import the custom faucet ABI
    const { Contract } = await import("ethers");
    
    // You'll need to import the FAUCET_ABI_CUSTOM from your abis file
    // This is a placeholder - replace with your actual custom ABI import
   

    const faucetContract = new Contract(faucetAddress, FAUCET_ABI_CUSTOM, provider);
    
    const hasCustomAmount = await faucetContract.hasCustomClaimAmount(userAddress);
    
    if (!hasCustomAmount) {
      return { hasAllocation: false };
    }
    
    const customAmount = await faucetContract.getCustomClaimAmount(userAddress);
    const formattedAmount = customAmount.toString();
    
    successLog('Custom allocation found', { 
      userAddress, 
      faucetAddress, 
      amount: formattedAmount 
    });
    
    return { 
      hasAllocation: true, 
      amount: formattedAmount 
    };
    
  } catch (error) {
    errorLog('Error checking custom allocation', error);
    return { 
      hasAllocation: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Export the debug function for custom claims
export async function debugCustomClaimRequest(
  userAddress: string,
  faucetAddress: string,
  chainId: number
) {
  console.log('🔍 Debugging custom claim request parameters...');
  
  const validation = {
    userAddress: {
      value: userAddress,
      isValid: /^0x[a-fA-F0-9]{40}$/.test(userAddress),
      isEmpty: !userAddress,
      length: userAddress?.length
    },
    faucetAddress: {
      value: faucetAddress,
      isValid: /^0x[a-fA-F0-9]{40}$/.test(faucetAddress),
      isEmpty: !faucetAddress,
      length: faucetAddress?.length
    },
    chainId: {
      value: chainId,
      isValid: SUPPORTED_CHAIN_IDS.includes(chainId),
      type: typeof chainId,
      validChains: SUPPORTED_CHAIN_IDS
    }
  };
  
  console.log('📊 Custom Claim Validation Results:', validation);
  
  const errors = [];
  if (!validation.userAddress.isValid) {
    errors.push(`Invalid userAddress: ${userAddress} (length: ${validation.userAddress.length})`);
  }
  if (!validation.faucetAddress.isValid) {
    errors.push(`Invalid faucetAddress: ${faucetAddress} (length: ${validation.faucetAddress.length})`);
  }
  if (!validation.chainId.isValid) {
    errors.push(`Invalid chainId: ${chainId} (type: ${validation.chainId.type}, valid: ${validation.chainId.validChains})`);
  }
  
  if (errors.length > 0) {
    console.error('❌ Custom Claim Validation Errors Found:', errors);
    return { valid: false, errors };
  }
  
  console.log('✅ All custom claim parameters valid');
  return { valid: true, errors: [] };
}

export async function claimNoCodeViaBackend(
  userAddress: string,
  faucetAddress: string,
  provider: BrowserProvider
): Promise<{ success: boolean; txHash: string; divviDebug?: any }> {
  try {
    debugLog('Input to claimNoCodeViaBackend', {
      userAddress,
      faucetAddress
    });

    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error("Wallet not detected. Please install MetaMask or another Ethereum wallet in a supported browser.");
    }

    if (!provider) {
      throw new Error("Provider not initialized. Please ensure your wallet is connected.");
    }

    // Use robust network detection instead of provider.getNetwork()
    const chainId = await getRobustChainId(provider);

    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}. Please switch to a supported network: ${SUPPORTED_CHAIN_IDS.join(', ')}`);
    }

    debugLog(`Starting drop process for chainId: ${chainId}`);

    const cleanUserAddress = userAddress.trim();
    const cleanFaucetAddress = faucetAddress.trim();

    console.log('🧹 Cleaned parameters for no-code claim:', {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId,
      divviSupported: shouldUseDivvi(chainId)
    });

    let payload: ClaimPayload = {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId
    };

    // Only process Divvi data if the chain is supported
    if (shouldUseDivvi(chainId)) {
      const divviResult = await processDivviReferralData(chainId, cleanUserAddress);
      
      if (divviResult.data) {
        payload.divviReferralData = divviResult.data;
        successLog('Added Divvi referral data to payload', { 
          length: divviResult.data.length,
          preview: `${divviResult.data.slice(0, 20)}...`
        });
      } else if (divviResult.error) {
        debugLog(`Proceeding without Divvi data: ${divviResult.error}`);
      }
    } else {
      debugLog(`Skipping Divvi integration for unsupported chain: ${chainId}`);
    }

    const requestLog: RequestLogData = {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId,
      hasDivviData: !!payload.divviReferralData,
      divviDataLength: payload.divviReferralData?.length || 0,
      timestamp: new Date().toISOString()
    };

    if (DEBUG_MODE) {
      requestLog.payload = JSON.stringify(payload, null, 2);
    }

    debugLog('Sending drop request without code', requestLog);

    const response = await fetch(`${API_URL}/claim-no-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { 
          detail: `Failed to parse backend response. Status: ${response.status} ${response.statusText}` 
        };
      }
      
      errorLog('Backend request failed', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `Backend request failed (${response.status}): ${JSON.stringify(errorData)}`
      );
    }

    const result = await response.json();
    successLog('Drop request without code successful', { 
      success: result.success, 
      txHash: result.txHash 
    });

    // Only report to Divvi if the chain is supported
    if (result.success && result.txHash && shouldUseDivvi(chainId)) {
      setTimeout(() => {
        reportToDivvi(result.txHash, chainId);
      }, 100);
    } else if (result.success && result.txHash) {
      debugLog(`No-code claim successful but not reporting to Divvi (unsupported chain: ${chainId})`);
    }

    if (DEBUG_MODE) {
      result.divviDebug = {
        chainSupported: shouldUseDivvi(chainId),
        divviUsed: !!payload.divviReferralData
      };
    }

    return result;
  } catch (error) {
    errorLog('Error in claimNoCodeViaBackend', error);
    throw error;
  }
}

export async function claimViaBackend(
  userAddress: string,
  faucetAddress: string,
  provider: BrowserProvider,
  secretCode: string
): Promise<{ success: boolean; txHash: string; divviDebug?: any }> {
  try {
    console.log('🚀 Starting claim process...');
    
    // Debug input parameters first
    const validation = await debugClaimRequest(userAddress, faucetAddress, secretCode, 42220);
    
    if (!validation.valid) {
      throw new Error(`Invalid request parameters: ${validation.errors.join(', ')}`);
    }

    // Use robust network detection
    const chainId = await getRobustChainId(provider);
    
    // Validate chainId specifically
    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}. Please switch to a supported network: ${SUPPORTED_CHAIN_IDS.join(', ')}`);
    }

    // Clean and validate addresses
    const cleanUserAddress = userAddress.trim();
    const cleanFaucetAddress = faucetAddress.trim();
    const cleanSecretCode = secretCode.trim().toUpperCase();
    
    console.log('🧹 Cleaned parameters:', {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      secretCode: cleanSecretCode,
      chainId,
      divviSupported: shouldUseDivvi(chainId)
    });

    // Claim tokens directly
    console.log('🎯 Proceeding with token claim...');
    
    let claimPayload: ClaimPayload = {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      secretCode: cleanSecretCode,
      chainId
    };

    // Only process Divvi data if the chain is supported
    if (shouldUseDivvi(chainId)) {
      const divviResult = await processDivviReferralData(chainId, cleanUserAddress);
      
      if (divviResult.data) {
        claimPayload.divviReferralData = divviResult.data;
        successLog('Added Divvi referral data to claim payload', { 
          length: divviResult.data.length,
          preview: `${divviResult.data.slice(0, 20)}...`
        });
      } else if (divviResult.error) {
        debugLog(`Proceeding without Divvi data: ${divviResult.error}`);
      }
    } else {
      debugLog(`Skipping Divvi integration for unsupported chain: ${chainId}`);
    }
    
    console.log('📤 Sending claim request:', {
      ...claimPayload,
      divviReferralData: claimPayload.divviReferralData ? 'Present' : 'Not included'
    });
    
    const claimResponse = await fetch(`${API_URL}/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(claimPayload),
    });
    
    console.log('📥 Claim response status:', claimResponse.status, claimResponse.statusText);
    
    if (!claimResponse.ok) {
      let errorData;
      const responseText = await claimResponse.text();
      
      console.log('📄 Raw claim response text:', responseText);
      
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Failed to parse claim error response as JSON:', e);
        errorData = { 
          detail: `Failed to parse backend response. Status: ${claimResponse.status} ${claimResponse.statusText}. Raw response: ${responseText}` 
        };
      }
      
      console.error('❌ Claim error details:', {
        status: claimResponse.status,
        statusText: claimResponse.statusText,
        errorData,
        requestPayload: claimPayload
      });
      
      // Handle specific error cases
      if (claimResponse.status === 400) {
        const errorMessage = errorData.detail || errorData.message || 'Bad Request';
        
        if (errorMessage.includes('Invalid address')) {
          throw new Error(`Address validation failed: ${errorMessage}`);
        } else if (errorMessage.includes('Invalid chainId')) {
          throw new Error(`Chain validation failed: ${errorMessage}. Current chainId: ${chainId}`);
        } else if (errorMessage.includes('Insufficient funds')) {
          throw new Error(`Backend wallet has insufficient funds: ${errorMessage}`);
        } else if (errorMessage.includes('Transaction failed')) {
          throw new Error(`Blockchain transaction failed: ${errorMessage}`);
        } else {
          throw new Error(`Bad Request (400): ${errorMessage}`);
        }
      } else if (claimResponse.status === 403) {
        const errorMessage = errorData.detail || errorData.message || 'Forbidden';
        
        if (errorMessage.includes('Invalid or expired secret code')) {
          throw new Error(`Secret code is invalid or expired: ${errorMessage}`);
        } else {
          throw new Error(`Access denied (403): ${errorMessage}`);
        }
      }
      
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `Backend request failed (${claimResponse.status}): ${JSON.stringify(errorData)}`
      );
    }
    
    const claimResult = await claimResponse.json();
    console.log('✅ Claim successful:', claimResult);

    // Only report to Divvi if the chain is supported
    if (claimResult.txHash && shouldUseDivvi(chainId)) {
      setTimeout(() => {
        reportToDivvi(claimResult.txHash, chainId);
      }, 100);
    } else if (claimResult.txHash) {
      debugLog(`Claim successful but not reporting to Divvi (unsupported chain: ${chainId})`);
    }
    
    return {
      success: true,
      txHash: claimResult.txHash,
      divviDebug: {
        claimTx: claimResult.txHash,
        chainSupported: shouldUseDivvi(chainId),
        divviUsed: !!claimPayload.divviReferralData
      }
    };
    
  } catch (error) {
    console.error('❌ Comprehensive error in claimViaBackend:', {
      error: error.message,
      stack: error.stack,
      userAddress,
      faucetAddress,
      secretCode: secretCode ? `${secretCode.substring(0, 2)}****` : 'undefined',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}