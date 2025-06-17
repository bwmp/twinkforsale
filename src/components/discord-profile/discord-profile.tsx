import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import type { LanyardData } from "~/lib/discord";
import {
  getLanyardData,
  connectLanyardSocket,
  getDiscordAvatarUrl,
  formatActivityType,
  getStatusColor,
  getStatusText,
} from "~/lib/discord";
import { Gamepad2, Eye, Zap, Trophy } from "lucide-icons-qwik";

export interface DiscordProfileProps {
  discordId: string;
  config?: {
    showAvatar?: boolean;
    showStatus?: boolean;
    showActivity?: boolean;
    showSpotify?: boolean;
    useFallbackPolling?: boolean; // fallback to HTTP polling if WebSocket fails
  };
  class?: string;
}

export const DiscordProfile = component$<DiscordProfileProps>(  ({ discordId, config = {}, class: className = "" }) => {
    const lanyardData = useSignal<LanyardData | null>(null);
    const loading = useSignal(true);
    const error = useSignal<string | null>(null);
    const currentTime = useSignal(Date.now());
    const connectionStatus = useSignal<"connecting" | "connected" | "disconnected" | "error">("connecting");

    const {
      showAvatar = true,
      showStatus = true,
      showActivity = true,
      showSpotify = true,
      useFallbackPolling = false,
    } = config;

    // Update current time every second for Spotify progress
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
      const timeInterval = setInterval(() => {
        currentTime.value = Date.now();
      }, 1000);

      return () => {
        clearInterval(timeInterval);
      };
    });    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(async () => {
      try {
        loading.value = true;
        error.value = null;
        connectionStatus.value = "connecting";

        // Try WebSocket connection first
        if (!useFallbackPolling) {
          const cleanup = connectLanyardSocket(
            discordId,
            (data) => {
              console.log("Received Lanyard data via WebSocket:", data);
              if (data.success) {
                lanyardData.value = data;
                connectionStatus.value = "connected";
                loading.value = false;
                error.value = null;
              } else {
                connectionStatus.value = "error";
                error.value = "Failed to fetch Discord data";
              }
            },
            (errorMsg) => {
              console.error("WebSocket error:", errorMsg);
              connectionStatus.value = "error";
              error.value = errorMsg;
              // Fallback to HTTP polling on WebSocket error
              fallbackToPolling();
            }
          );

          return cleanup;
        } else {
          // Use HTTP polling as fallback
          fallbackToPolling();
        }

        function fallbackToPolling() {
          console.log("Using HTTP polling fallback");
          const fetchData = async () => {
            try {
              const data = await getLanyardData(discordId);
              if (data.success) {
                lanyardData.value = data;
                connectionStatus.value = "connected";
                loading.value = false;
                error.value = null;
              } else {
                connectionStatus.value = "error";
                error.value = "Failed to fetch Discord data";
              }
            } catch (err) {
              connectionStatus.value = "error";
              error.value = "Error loading Discord profile";
              console.error(err);
            }
          };

          // Initial fetch
          fetchData();

          // Set up polling interval (30 seconds)
          const interval = setInterval(fetchData, 30 * 1000);

          return () => {
            clearInterval(interval);
          };
        }
      } catch (err) {
        connectionStatus.value = "error";
        error.value = "Error initializing Discord profile";
        console.error(err);
        loading.value = false;
      }
    });

    if (loading.value) {
      return (
        <div
          class={`animate-pulse rounded-lg bg-[#5865f2]/10 p-4 ${className}`}
        >
          <div class="flex items-center space-x-3">
            <div class="h-12 w-12 rounded-full bg-[#5865f2]/20"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-24 rounded bg-[#5865f2]/20"></div>
              <div class="h-3 w-16 rounded bg-[#5865f2]/20"></div>
            </div>
          </div>
        </div>
      );
    }

    if (
      error.value ||
      !lanyardData.value?.success ||
      !lanyardData.value?.data
    ) {
      return (
        <div class={`rounded-lg bg-red-500/10 p-4 text-red-400 ${className}`}>
          <p class="text-sm">Discord profile unavailable</p>
        </div>
      );
    }

    const { data } = lanyardData.value;
    const user = data.discord_user;
    const avatarUrl = getDiscordAvatarUrl(user.id, user.avatar, 128);
    const statusColor = getStatusColor(data.discord_status);
    const statusText = getStatusText(data.discord_status);

    // Get primary activity (non-Spotify, non-custom status)
    const primaryActivity = data.activities.find(
      (activity) => activity.type !== 2 && activity.type !== 4,
    );

    // Get custom status
    const customStatus = data.activities.find(
      (activity) => activity.type === 4,
    );

    return (
      <div
        class={`rounded-lg border border-[#5865f2]/20 bg-[#5865f2]/5 p-4 backdrop-blur-sm ${className}`}
      >
        {/* Header */}
        <div class="mb-3 flex items-center space-x-3">
          {showAvatar && (
            <div class="relative">
              <img
                src={avatarUrl}
                alt={`${user.global_name || user.username}'s avatar`}
                class="h-12 w-12 rounded-full"
                width={48}
                height={48}
              />
              {showStatus && (
                <div
                  class="absolute -right-1 -bottom-1 h-4 w-4 rounded-full border-2 border-[#2f3136]"
                  style={{ backgroundColor: statusColor }}
                  title={statusText}
                ></div>
              )}
            </div>
          )}
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-left font-semibold text-white">
              @{user.username}
            </h3>
            {customStatus && (
              <div class="mb-3 rounded-md p-2">
                <div class="flex items-center space-x-2 text-sm text-gray-300">
                  {customStatus.emoji && (
                    <span class="text-base">
                      {customStatus.emoji.id ? (
                        <img
                          src={`https://cdn.discordapp.com/emojis/${customStatus.emoji.id}.${
                            customStatus.emoji.animated ? "gif" : "png"
                          }?size=16`}
                          width={16}
                          height={16}
                          alt={customStatus.emoji.name}
                          class="inline"
                        />
                      ) : (
                        customStatus.emoji.name
                      )}
                    </span>
                  )}
                  <span>{customStatus.state || "Custom Status"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Activity */}
        {showActivity && primaryActivity && (
          <div class="mb-3 rounded-md bg-[#5865f2]/10 p-2">
            <div class="flex flex-col items-start space-x-2">
              <div class="mt-0.5 flex flex-shrink-0 flex-row gap-2">
                {primaryActivity.type === 0 && (
                  <Gamepad2 class="h-4 w-4 text-green-400" />
                )}
                {primaryActivity.type === 1 && (
                  <Zap class="h-4 w-4 text-purple-400" />
                )}
                {primaryActivity.type === 3 && (
                  <Eye class="h-4 w-4 text-blue-400" />
                )}
                {primaryActivity.type === 5 && (
                  <Trophy class="h-4 w-4 text-yellow-400" />
                )}
                <p class="text-xs font-medium text-gray-300">
                  {formatActivityType(primaryActivity.type)}
                </p>
              </div>              <div class="flex items-start space-x-3">
                {primaryActivity.assets?.large_image && (
                  <div class="relative h-12 w-12 flex-shrink-0">
                    <img
                      src={
                        primaryActivity.assets.large_image.startsWith("mp:")
                          ? `https://media.discordapp.net/${primaryActivity.assets.large_image.slice(3)}`
                          : `https://cdn.discordapp.com/app-assets/${primaryActivity.application_id}/${primaryActivity.assets.large_image}.png`
                      }
                      alt={
                        primaryActivity.assets.large_text || primaryActivity.name
                      }
                      class="h-12 w-12 rounded"
                      width={48}
                      height={48}
                    />
                    {primaryActivity.assets?.small_image && (
                      <img
                        src={
                          primaryActivity.assets.small_image.startsWith("mp:")
                            ? `https://media.discordapp.net/${primaryActivity.assets.small_image.slice(3)}`
                            : `https://cdn.discordapp.com/app-assets/${primaryActivity.application_id}/${primaryActivity.assets.small_image}.png`
                        }
                        alt={primaryActivity.assets.small_text || "Status"}
                        class="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-gray-900 bg-gray-900"
                        width={16}
                        height={16}
                      />
                    )}
                  </div>
                )}
                <div class="min-w-0 flex-1 text-start">
                  <p class="truncate text-sm font-semibold text-white">
                    {primaryActivity.name}
                  </p>
                  {primaryActivity.details && (
                    <p class="truncate text-xs text-gray-400">
                      {primaryActivity.details}
                    </p>
                  )}
                  {primaryActivity.state && (
                    <p class="truncate text-xs text-gray-400">
                      {primaryActivity.state}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Spotify */}
        {showSpotify && data.listening_to_spotify && data.spotify && (
          <div class="rounded-md bg-[#1db954]/10 p-2">
            <div class="flex items-start space-x-3">
              {data.spotify.album_art_url && (
                <img
                  src={data.spotify.album_art_url}
                  alt={`${data.spotify.album} cover`}
                  class="flex-shrink-0 rounded"
                  width={96}
                  height={96}
                />
              )}
              <div class="min-w-0 flex-1">
                <p class="truncate text-left text-sm font-semibold text-white">
                  {data.spotify.song}
                </p>
                <p class="truncate text-left text-xs text-gray-400">
                  by {data.spotify.artist}
                </p>
                {data.spotify.album && (
                  <p class="truncate text-left text-xs text-gray-400">
                    on {data.spotify.album}
                  </p>
                )}
                {data.spotify.timestamps && (
                  <div class="mt-3 space-y-1">
                    <div class="flex justify-between text-xs text-gray-400">
                      <span>
                        {Math.floor(
                          Math.min(
                            currentTime.value - data.spotify.timestamps.start,
                            data.spotify.timestamps.end -
                              data.spotify.timestamps.start,
                          ) /
                            1000 /
                            60,
                        )}
                        :
                        {String(
                          Math.floor(
                            (Math.min(
                              currentTime.value - data.spotify.timestamps.start,
                              data.spotify.timestamps.end -
                                data.spotify.timestamps.start,
                            ) /
                              1000) %
                              60,
                          ),
                        ).padStart(2, "0")}
                      </span>
                      <span>
                        {Math.floor(
                          (data.spotify.timestamps.end -
                            data.spotify.timestamps.start) /
                            1000 /
                            60,
                        )}
                        :
                        {String(
                          Math.floor(
                            ((data.spotify.timestamps.end -
                              data.spotify.timestamps.start) /
                              1000) %
                              60,
                          ),
                        ).padStart(2, "0")}
                      </span>
                    </div>
                    <div class="h-1 w-full rounded-full bg-gray-700">
                      <div
                        class="h-1 rounded-full bg-[#1db954] transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              ((currentTime.value -
                                data.spotify.timestamps.start) /
                                (data.spotify.timestamps.end -
                                  data.spotify.timestamps.start)) *
                                100,
                            ),
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Progress Bar */}
          </div>
        )}
      </div>
    );
  },
);
