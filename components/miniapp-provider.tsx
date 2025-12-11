"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

interface MiniAppContextType {
  isSDKLoaded: boolean;
  isMiniApp: boolean;
  context: any | null;
}

const MiniAppContext = createContext<MiniAppContextType>({
  isSDKLoaded: false,
  isMiniApp: false,
  context: null,
});

export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [context, setContext] = useState<any>(null);

  useEffect(() => {
    const initSDK = async () => {
      try {
        const inMiniApp = await sdk.context.isInMiniApp();
        setIsMiniApp(inMiniApp);

        if (inMiniApp) {
          await sdk.actions.ready();
          const ctx = await sdk.context.get();
          setContext(ctx);
          console.log("Farcaster SDK initialized", ctx);
        }
        
        setIsSDKLoaded(true);
      } catch (error) {
        console.error("Failed to initialize Farcaster SDK:", error);
        setIsSDKLoaded(true);
      }
    };

    initSDK();
  }, []);

  if (!isSDKLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <MiniAppContext.Provider value={{ isSDKLoaded, isMiniApp, context }}>
      {children}
    </MiniAppContext.Provider>
  );
}

export function useMiniApp() {
  return useContext(MiniAppContext);
}