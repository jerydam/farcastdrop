"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { NetworkSelector } from "@/components/network-selector"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Plus, Menu, X } from "lucide-react"
import { useWallet } from "@/hooks/use-wallet"
import { JoinDroplistButton } from '@/components/droplist'
import Link from 'next/link'

export default function Head() {
  const router = useRouter()
  const { address, isConnected } = useWallet()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <header className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 relative z-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6">
        {/* Logo and Title with Mobile Menu Button */}
        <div className="flex justify-between items-center w-full lg:w-auto">
          <Link href="/">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="FaucetDrops Logo"
                  width={32}
                  height={32}
                  className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-md object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">
                  FaucetDrops
                </h1>
                <div className="hidden sm:flex gap-1">
                  <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    Free, Fast, Fair & Frictionless Token Distribution 💧
                  </span>
                </div>
              </div>
            </div>
          </Link>
          
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu Content */}
        <div className={`lg:hidden w-full z-50 ${isMenuOpen ? 'block' : 'hidden'}`}>
          <div className="pt-4 space-y-4">
            <div className="flex flex-col space-y-3">
              {/* Wallet Status */}
              {isConnected && address && (
                <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-700">
                  <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-sm font-mono text-purple-700 dark:text-purple-300">
                    {formatAddress(address)}
                  </span>
                </div>
              )}
              
              <Button
                onClick={() => router.push('/create-faucet')}
                size="sm"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span>Create Faucet</span>
              </Button>

              <JoinDroplistButton />
              
              <div className="py-1">
                <NetworkSelector className='w-full' />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Wallet Status */}
          {isConnected && address && (
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-full border border-purple-200 dark:border-purple-700">
              <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-sm font-mono text-purple-700 dark:text-purple-300">
                {formatAddress(address)}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push('/create-faucet')}
              size="sm"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Create Faucet</span>
            </Button>

            <JoinDroplistButton />
          </div>

          <div className="py-1">
            <NetworkSelector />
          </div>
        </div>
      </div>
      
      {/* Mobile menu backdrop */}
      {isMenuOpen && isMounted && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </header>
  )
}