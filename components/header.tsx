"use client"

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "@/components/wallet-connect";
import { NetworkSelector } from "@/components/network-selector";
import Link from "next/link";
import { ArrowBigLeft, ArrowLeft, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { JoinDroplistButton } from "./droplist";

export function Header({ pageTitle }: { pageTitle: string }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-6 bg-background">
     
      <h1 className="text-base sm:text-lg font-semibold" title="Go Back Home"><Link href="/">{pageTitle}</Link></h1>
    
      {/* Mobile Toggle Button */}
      <div className="sm:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="p-1 ml-auto"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? (
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>
      </div>

      {/* Mobile Menu */}
      <div
        ref={menuRef}
        className={`${isMenuOpen ? "block" : "hidden"
          } sm:hidden absolute top-14 sm:top-16 right-4 bg-background border rounded-lg shadow-lg p-4 w-48 z-50`}
      >
        <div className="flex flex-col gap-2">
          <NetworkSelector />
          
          <JoinDroplistButton/>
          <WalletConnectButton />
          <Button
            onClick={() => router.push('/')}
            size="sm"
            className="w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Button>
        </div>
      </div>

      {/* Desktop Actions */}
      <div className="hidden sm:flex items-center gap-2 sm:gap-3">
        <NetworkSelector />
        
        
        <JoinDroplistButton/>
        <WalletConnectButton />
        <Button
          onClick={() => router.push('/')}
          size="sm"
          className="w-full flex items-center justify-center gap-2"
        >
           <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Button>
      </div>
    </header>
  );
}