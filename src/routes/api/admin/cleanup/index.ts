import type { RequestHandler } from "@builder.io/qwik-city";
import { cleanupExpiredFiles } from "~/lib/cleanup";

export const onPost: RequestHandler = async ({sharedMap, json}) => {
  try {
    // Check if user is admin (you might want to add proper authentication here)
    const session = sharedMap.get("session");
    
    if (!session?.user?.email) {
      throw json(401, { error: "Unauthorized" });
    }

    // Import db inside the handler
    const { db } = await import("~/lib/db");
    
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { isAdmin: true }
    });

    if (!user?.isAdmin) {
      throw json(403, { error: "Admin access required" });
    }

    // Run cleanup
    const result = await cleanupExpiredFiles();
    
    throw json(200, { 
      success: true, 
      message: `Cleanup completed. ${result.cleaned} files removed.`,
      cleaned: result.cleaned
    });
    
  } catch (error: any) {
    console.error("Cleanup API error:", error);
    
    if (error.status) {
      throw error; // Re-throw json responses
    }
    
    throw json(500, { 
      error: "Cleanup failed", 
      details: error.message 
    });
  }
};
