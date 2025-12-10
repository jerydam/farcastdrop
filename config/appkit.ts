import { wagmiConfig } from './wagmi'
import { QueryClient } from '@tanstack/react-query'

export const wagmiAdapter = wagmiConfig
export const queryClient = new QueryClient()