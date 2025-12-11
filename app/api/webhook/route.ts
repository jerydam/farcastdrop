import { NextRequest, NextResponse } from "next/server";

// Define the expected shape of the Farcaster webhook body
interface FarcasterWebhookBody {
  event: "miniapp_added" | "miniapp_removed" | "notifications_enabled" | "notifications_disabled";
  fid: number;
  notificationDetails?: {
    url: string;
    token: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FarcasterWebhookBody;

    // In a production app, you MUST verify the signature here
    // using @farcaster/frame-node to ensure the request is real.

    console.log("Farcaster Webhook Received:", body.event);

    if (body.event === "miniapp_added" || body.event === "notifications_enabled") {
      // Verify notificationDetails exists before accessing
      if (body.notificationDetails) {
        const { token } = body.notificationDetails;
        
        // TODO: Save this token + the user's FID to your database.
        // You need this token later to send them push notifications.
        console.log(`Save token for FID ${body.fid}:`, token);
      } else {
        console.warn("Notification details missing for enabled event");
      }
    }

    if (body.event === "notifications_disabled" || body.event === "miniapp_removed") {
      // TODO: Remove the token from your database so you stop sending notifications.
      console.log(`Remove token for FID ${body.fid}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}