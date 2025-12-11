"use client";

import sdk from "@farcaster/miniapp-sdk";
import { useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BellPlus, Check } from "lucide-react";

export function FarcasterActions() {
  const [isAdded, setIsAdded] = useState(false);

  // Check if already added on mount
  useEffect(() => {
    const checkContext = async () => {
      const context = await sdk.context;
      if (context?.client.added) {
        setIsAdded(true);
      }
    };
    checkContext();
  }, []);

  const handleAddFrame = useCallback(async () => {
    try {
      const result = await sdk.actions.addFrame();
      if (result.added) {
        setIsAdded(true);
      }
    } catch (error) {
      console.error("Failed to add frame:", error);
    }
  }, []);

  if (isAdded) {
    return (
      <Button variant="secondary" disabled className="w-full gap-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
        <Check className="w-4 h-4" />
        Notifications Active
      </Button>
    );
  }

  return (
    <Button onClick={handleAddFrame} className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
      <BellPlus className="w-4 h-4" />
      Enable Notifications
    </Button>
  );
}