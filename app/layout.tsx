import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Footer } from "@/components/footer"
import { Providers } from "@/components/provider" // Import the client component we just made

const inter = Inter({ subsets: ["latin"] })

const appUrl = process.env.NEXT_PUBLIC_URL || "https://cast.faucetdrops.io";

// Define the Farcaster Frame Metadata
const frameMetadata = JSON.stringify({
  version: "next",
  imageUrl: `${appUrl}/default.jpeg`, 
  button: {
    title: "Drip Tokens 💧",
    action: {
      type: "launch_frame",
      name: "FaucetDrops",
      url: appUrl,
      splashImageUrl: `${appUrl}/favicon.png`,
      splashBackgroundColor: "#020817",
    },
  },
});

export const metadata: Metadata = {
  title: "FaucetDrops",
  description: "Automated onchain reward and engagement platform 💧",
  icons: {
    icon: "/favicon.png",
  },
  other: {
    "fc:frame": frameMetadata,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Optional: Add manual meta tags if needed, but 'metadata' handles most */}
      </head>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}