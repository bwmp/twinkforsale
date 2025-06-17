import { db } from "~/lib/db";

export interface LanyardData {
  success: boolean;
  error?: string;
  data?: {
    discord_user: {
      id: string;
      username: string;
      avatar: string;
      discriminator: string;
      bot: boolean;
      global_name: string | null;
      display_name: string | null;
      public_flags: number;
    };
    discord_status: "online" | "idle" | "dnd" | "offline";
    activities: Array<{
      id: string;
      name: string;
      type: number;
      state?: string;
      details?: string;
      timestamps?: {
        start?: number;
        end?: number;
      };
      emoji?: {
        name: string;
        id?: string;
        animated?: boolean;
      };
      party?: {
        id?: string;
        size?: [number, number];
      };
      assets?: {
        large_image?: string;
        large_text?: string;
        small_image?: string;
        small_text?: string;
      };
      secrets?: {
        join?: string;
        spectate?: string;
        match?: string;
      };
      instance?: boolean;
      flags?: number;
      buttons?: Array<{
        label: string;
        url: string;
      }>;
      application_id?: string;
      created_at?: number;
    }>;
    spotify?: {
      track_id: string;
      timestamps: {
        start: number;
        end: number;
      };
      song: string;
      artist: string;
      album_art_url: string;
      album: string;
    };
    listening_to_spotify: boolean;
    kv?: Record<string, string>;
  };
}

/**
 * Get Discord user ID from OAuth account data
 */
export async function getDiscordIdFromUser(userId: string): Promise<string | null> {
  try {
    const discordAccount = await db.account.findFirst({
      where: {
        userId: userId,
        provider: "discord",
      },
      select: {
        providerAccountId: true,
      },
    });

    return discordAccount?.providerAccountId || null;
  } catch (error) {
    console.error("Error fetching Discord ID:", error);
    return null;
  }
}

/**
 * Fetch Lanyard data for a Discord user (fallback for initial load)
 */
export async function getLanyardData(discordId: string): Promise<LanyardData> {
  try {
    const response = await fetch(`https://lanyard.twink.forsale/v1/users/${discordId}`, {
      headers: {
        "User-Agent": "twink.forsale/1.0",
      },
    });

    if (response.status === 404) {
      return { 
        success: false, 
        error: "Discord user not found. You need to either join our Discord server (https://discord.gg/TDsQpa9tdT) or invite the bot to your Discord server to use this feature." 
      };
    }

    if (!response.ok || response.status !== 200) {
      return { success: false };
    }

    const data = await response.json();
    
    // Check if discord_user data is missing
    if (!data.data?.discord_user) {
      return { 
        success: false, 
        error: "Discord user data not available. You need to either join our Discord server (https://discord.gg/TDsQpa9tdT) or invite the bot to your Discord server to use this feature." 
      };
    }
    
    return data;
  } catch (error) {
    console.error("Error fetching Lanyard data:", error);
    return { success: false };
  }
}

/**
 * Connect to Lanyard WebSocket for real-time updates
 */
export function connectLanyardSocket(
  discordId: string,
  onData: (data: LanyardData) => void,
  onError?: (error: string) => void
): () => void {
  let ws: WebSocket | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isReconnecting = false;

  const connect = () => {
    try {
      ws = new WebSocket("wss://lanyard.twink.forsale/socket");

      ws.onopen = () => {
        console.log("Lanyard WebSocket connected");
        // Subscribe to user
        ws?.send(JSON.stringify({
          op: 2,
          d: {
            subscribe_to_id: discordId
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.op) {
            case 1: // Hello
              // Set up heartbeat
              if (heartbeatInterval) clearInterval(heartbeatInterval);
              heartbeatInterval = setInterval(() => {
                ws?.send(JSON.stringify({ op: 3 }));
              }, message.d.heartbeat_interval);
              break;
                case 0: // Event
              if (message.t === "INIT_STATE" || message.t === "PRESENCE_UPDATE") {
                // Check if discord_user data is missing
                if (!message.d?.discord_user) {
                  onData({
                    success: false,
                    error: "Discord user data not available. You need to either join the Lanyard Discord server (https://discord.gg/lanyard) or invite the Lanyard bot to your Discord server to use this feature."
                  });
                  return;
                }
                
                onData({
                  success: true,
                  data: message.d
                });
              }
              break;
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("Lanyard WebSocket disconnected");
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        
        // Attempt to reconnect if not manually closed
        if (!isReconnecting) {
          isReconnecting = true;
          reconnectTimeout = setTimeout(() => {
            isReconnecting = false;
            connect();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error("Lanyard WebSocket error:", error);
        onError?.("WebSocket connection error");
      };

    } catch (error) {
      console.error("Error connecting to Lanyard WebSocket:", error);
      onError?.("Failed to connect to WebSocket");
    }
  };

  // Initial connection
  connect();

  // Return cleanup function
  return () => {
    isReconnecting = true; // Prevent reconnection
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    if (ws) {
      ws.close();
    }
  };
}

/**
 * Get Discord avatar URL
 */
export function getDiscordAvatarUrl(
  userId: string, 
  avatarHash: string | null, 
  size: number = 128
): string {
  if (!avatarHash) {
    // Default Discord avatar
    const defaultNum = parseInt(userId) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultNum}.png`;
  }

  const format = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${format}?size=${size}`;
}

/**
 * Format activity type for display
 */
export function formatActivityType(type: number): string {
  switch (type) {
    case 0:
      return "Playing";
    case 1:
      return "Streaming";
    case 2:
      return "Listening to";
    case 3:
      return "Watching";
    case 4:
      return "Custom Status";
    case 5:
      return "Competing in";
    default:
      return "Unknown";
  }
}

/**
 * Get status color for Discord status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "online":
      return "#23a55a";
    case "idle":
      return "#f0b232";
    case "dnd":
      return "#f23f43";
    case "offline":
    default:
      return "#80848e";
  }
}

/**
 * Get status text for Discord status
 */
export function getStatusText(status: string): string {
  switch (status) {
    case "online":
      return "Online";
    case "idle":
      return "Idle";
    case "dnd":
      return "Do Not Disturb";
    case "offline":
    default:
      return "Offline";
  }
}

/**
 * Auto-populate Discord ID for users who logged in with Discord
 */
export async function autoPopulateDiscordId(userId: string): Promise<boolean> {
  try {
    const discordId = await getDiscordIdFromUser(userId);
    
    if (!discordId) {
      return false;
    }

    // Update user with Discord ID if not already set
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { bioDiscordUserId: true },
    });

    if (!user?.bioDiscordUserId) {
      await db.user.update({
        where: { id: userId },
        data: {
          bioDiscordUserId: discordId,
        },
      });
    }

    return true;
  } catch (error) {
    console.error("Error auto-populating Discord ID:", error);
    return false;
  }
}
