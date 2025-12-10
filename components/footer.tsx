"use client"

import React from "react"
import { Github, Mail, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

// Custom icons for X (Twitter) and Telegram since lucide-react doesn't have them
const XIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
)

interface FooterProps {
  className?: string
}

export const Footer: React.FC<FooterProps> = ({ className = "" }) => {
  const socialLinks = [
    {
      name: "X (Twitter)",
      href: "https://x.com/faucetdrops", // Replace with your actual handle
      icon: XIcon,
      hoverColor: "hover:text-sky-500"
    },
    {
      name: "YouTube",
      href: "https://www.youtube.com/@Faucet_Drops", // Replace with your actual channel
      icon: Youtube,
      hoverColor: "hover:text-red-500"
    },
    {
      name: "Telegram",
      href: "https://t.me/faucetdropschat", // Replace with your actual channel
      icon: TelegramIcon,
      hoverColor: "hover:text-blue-500"
    },
    {
      name: "GitHub",
      href: "https://github.com/Priveedores-de-soluciones/Faucet_drops", // Replace with your actual repo
      icon: Github,
      hoverColor: "hover:text-gray-600 dark:hover:text-gray-300"
    },
    {
      name: "Email",
      href: "mailto:drops.faucet@gmail.com", // Replace with your actual email
      icon: Mail,
      hoverColor: "hover:text-green-500"
    }
  ]

  return (
    <footer className={`bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-8 ${className}`}>
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        <div className="flex flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            {/* Logo and Brand */}
            <div className="flex lg:flex-row max-lg:flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <Image
                    src="/logo.png"
                    alt="FaucetDrops Logo"
                    width={32}
                    height={32}
                    className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-md object-contain"
                  />

                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  FaucetDrops
                </h3>
              </div>
              <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 ml-1">
                Free, Fast, Fair & Frictionless Token Distribution 💧
              </span>
            </div>
            {/* Copyright and Links */}
            <div className="flex flex-row items-center gap-1 sm:gap-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <div className="whitespace-nowrap">
                &copy; {new Date().getFullYear()} FaucetDrops
                {/* <span className="flex items-center gap-2 sm:gap-3"> */}
                  <Link
                    href="/privacy"
                    className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors whitespace-nowrap"
                  >
                    Privacy
                  </Link>
                  <Link
                    href="/terms"
                    className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors whitespace-nowrap"
                  >
                    Terms
                  </Link>
                {/* </span> */}
              </div>
            </div>
          </div>
          {/* Social Links */}
          <div className="flex items-center gap-1 sm:gap-2">
            {socialLinks.map((link) => {
              const IconComponent = link.icon
              return (
                <Button
                  key={link.name}
                  variant="ghost"
                  size="sm"
                  asChild
                  className={`h-7 w-7 p-0 text-slate-500 dark:text-slate-400 transition-colors ${link.hoverColor}`}
                >
                  <Link
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.name}
                    title={link.name}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )
            })}
          </div>


        </div>
      </div>
    </footer>
  )
}