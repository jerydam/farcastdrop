// lib/farcaster-utils.ts
import sdk from "@farcaster/miniapp-sdk"

/**
 * Check if the app is running inside a Farcaster MiniApp
 */
export function isInMiniApp(): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    return !!sdk.wallet
  } catch {
    return false
  }
}

/**
 * Initialize Farcaster SDK - call this early in your app
 */
export async function initializeFarcaster(): Promise<void> {
  if (!isInMiniApp()) return
  
  try {
    await sdk.actions.ready()
    console.log('✅ Farcaster SDK initialized')
  } catch (error) {
    console.error('Failed to initialize Farcaster SDK:', error)
    throw error
  }
}

/**
 * Get Quick Auth token for API authentication
 */
export async function getAuthToken(): Promise<string | null> {
  if (!isInMiniApp()) return null
  
  try {
    const token = await sdk.quickAuth.getToken()
    return token
  } catch (error) {
    console.error('Failed to get auth token:', error)
    return null
  }
}

/**
 * Sign in with Farcaster and get credential
 */
export async function signInWithFarcaster() {
  if (!isInMiniApp()) {
    throw new Error('Not in Farcaster MiniApp environment')
  }
  
  try {
    const credential = await sdk.actions.signIn()
    return credential
  } catch (error) {
    console.error('Failed to sign in with Farcaster:', error)
    throw error
  }
}

/**
 * Navigate back in Farcaster client
 */
export function navigateBack(): void {
  if (!isInMiniApp()) return
  
  try {
    sdk.back()
  } catch (error) {
    console.error('Failed to navigate back:', error)
  }
}

/**
 * Trigger haptic feedback
 */
export const haptics = {
  impact: (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!isInMiniApp()) return
    try {
      sdk.haptics.impact(style)
    } catch (error) {
      console.error('Haptic feedback failed:', error)
    }
  },
  
  notification: (type: 'success' | 'warning' | 'error' = 'success') => {
    if (!isInMiniApp()) return
    try {
      sdk.haptics.notification(type)
    } catch (error) {
      console.error('Haptic feedback failed:', error)
    }
  },
  
  selection: () => {
    if (!isInMiniApp()) return
    try {
      sdk.haptics.selection()
    } catch (error) {
      console.error('Haptic feedback failed:', error)
    }
  }
}

/**
 * Get shared cast if app was opened via share sheet
 */
export async function getSharedCast() {
  if (!isInMiniApp()) return null
  
  try {
    const cast = await sdk.context.cast_share
    return cast
  } catch (error) {
    console.error('Failed to get shared cast:', error)
    return null
  }
}

/**
 * Get Farcaster context (user info, location, etc.)
 */
export async function getFarcasterContext() {
  if (!isInMiniApp()) return null
  
  try {
    return {
      user: await sdk.context.user,
      location: await sdk.context.location,
      cast: await sdk.context.cast
    }
  } catch (error) {
    console.error('Failed to get Farcaster context:', error)
    return null
  }
}