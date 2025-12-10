import { wagmiConfig } from './wagmi'
import { QueryClient } from '@tanstack/react-query'

// ✅ KEY FIX: Must use "export const"
export const wagmiAdapter = wagmiConfig

// ✅ KEY FIX: Must use "export const"
export const queryClient = new QueryClient()

// Legacy exports to prevent other errors
export const projectId = ''
export const networks = []
export const modal = null