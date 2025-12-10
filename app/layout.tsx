import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Footer } from "@/components/footer"
import { Providers } from "@/components/providers" // Import the new component

const inter = Inter({ subsets: ["latin"] })

// Define the MiniApp metadata for the head tag
// This tells Farcaster clients how to launch your frame
const appUrl = process.env.NEXT_PUBLIC_URL || "https://faucetdroptest.vercel.app";

const frameMetadata = JSON.stringify({
  version: "next",
  imageUrl: `${appUrl}/opengraph-image.png`, // Make sure this image exists
  button: {
    title: "Drip Tokens 💧",
    action: {
      type: "launch_frame",
      name: "FaucetDrops",
      url: appUrl,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#020817",
    },
  },
});

export const metadata: Metadata = {
  title: "FaucetDrops ",
  description: "Token Drops Made Easy 💧",
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
    <html lang="en">
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