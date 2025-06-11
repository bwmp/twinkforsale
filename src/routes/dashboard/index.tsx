import { component$, $, useContext } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { db } from "~/lib/db";
import { getServerEnvConfig } from "~/lib/env";
import { getUserAnalytics } from "~/lib/analytics";
import { Folder, Eye, HardDrive, Key, Settings, Share, File, TrendingUp } from "lucide-icons-qwik";
import { ImagePreviewContext } from "~/lib/image-preview-store";
import { AnalyticsChart } from "~/components/analytics-chart/analytics-chart";

export const useUserData = routeLoader$(async (requestEvent) => {
  const session = requestEvent.sharedMap.get("session");

  if (!session?.user?.email) {
    throw requestEvent.redirect(302, "/");
  }

  // Get environment configuration for storage limits
  const config = getServerEnvConfig();

  // Find or create user
  let user = await db.user.findUnique({
    where: { email: session.user.email },
    include: {
      uploads: {
        orderBy: { createdAt: "desc" },
        take: 10
      },
      apiKeys: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email: session.user.email,
        name: session.user.name || null,
        image: session.user.image || null
      },
      include: {
        uploads: true,
        apiKeys: true
      }
    });
  }

  // Calculate stats
  const totalUploads = await db.upload.count({
    where: { userId: user.id }
  });

  const totalViews = await db.upload.aggregate({
    where: { userId: user.id },
    _sum: { views: true }
  });
  // Calculate the effective storage limit (user's custom limit or default from env)
  const effectiveStorageLimit = user.maxStorageLimit || config.BASE_STORAGE_LIMIT;

  // Get user analytics for the last 7 days
  const analyticsData = await getUserAnalytics(user.id, 7);

  return {
    user,
    stats: {
      totalUploads,
      totalViews: totalViews._sum.views || 0,
      storageUsed: user.storageUsed,
      maxStorage: effectiveStorageLimit
    },
    analyticsData,
    origin: requestEvent.url.origin
  };
});

export default component$(() => {
  const userData = useUserData();
  const imagePreviewStore = useContext(ImagePreviewContext);
  const copyToClipboard = $((shortCode: string) => {
    const url = `${userData.value.origin}/f/${shortCode}`;
    navigator.clipboard.writeText(url);
    // Could add a toast notification here
  });
  const handleImageClick = $((shortCode: string, fileName: string) => {
    const imageUrl = `/f/${shortCode}`;
    imagePreviewStore.openPreview(imageUrl, fileName);
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <>
      {/* Page Header */}
      <div class="mb-6 sm:mb-8 text-center">
        <h1 class="text-3xl sm:text-4xl font-bold text-gradient-cute mb-3 flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          Welcome back, {userData.value.user.name || "cutie"}!
        </h1>
        <p class="text-pink-200 text-base sm:text-lg px-4">
          Your kawaii dashboard is ready~ Manage uploads, API keys, and more! (◕‿◕)♡
        </p>
      </div>

      {/* Account Status Banner */}
      {!userData.value.user.isApproved && (
        <div class="mb-6 sm:mb-8 p-4 sm:p-6 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-xl">
          <div class="flex items-center justify-center text-center">
            <div>
              <h3 class="font-semibold text-lg mb-2">Account Pending Approval</h3>
              <p class="text-sm">
                Your account is awaiting admin approval. You'll be able to upload files and create API keys once approved.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Admin Link */}
      {userData.value.user.isAdmin && (
        <div class="mb-6 sm:mb-8 text-center">
          <Link
            href="/admin"
            class="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            <Settings class="w-4 h-4 mr-2" />
            Admin Dashboard
          </Link>
        </div>
      )}
      {/* Stats Cards */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div class="card-cute p-4 sm:p-6 rounded-3xl">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full">
              <Folder class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200">Total Uploads</p>
              <p class="text-lg sm:text-2xl font-bold text-white">{userData.value.stats.totalUploads}</p>
            </div>
          </div>
        </div>
        <div class="card-cute p-4 sm:p-6 rounded-3xl">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full" style="animation-delay: 0.2s;">
              <Eye class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200">Total Views</p>
              <p class="text-lg sm:text-2xl font-bold text-white">{userData.value.stats.totalViews}</p>
            </div>
          </div>
        </div>
        <div class="card-cute p-4 sm:p-6 rounded-3xl">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full" style="animation-delay: 0.4s;">
              <HardDrive class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200">Storage Used</p>
              <p class="text-lg sm:text-2xl font-bold text-white">
                {formatFileSize(userData.value.stats.storageUsed)}
              </p>
            </div>
          </div>
        </div>
        <div class="card-cute p-4 sm:p-6 rounded-3xl">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-full" style="animation-delay: 0.6s;">
              <Key class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200">API Keys</p>
              <p class="text-lg sm:text-2xl font-bold text-white">{userData.value.user.apiKeys.length}</p>
            </div>
          </div>        </div>
      </div>

      {/* Analytics Section */}
      <div class="mb-6 sm:mb-8">
        <h2 class="text-xl sm:text-2xl font-bold text-gradient-cute mb-4 sm:mb-6 text-center flex items-center justify-center gap-2">
          <TrendingUp class="w-5 h-5" />
          Your Analytics - Last 7 Days
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <AnalyticsChart
            data={userData.value.analyticsData || []}
            metric="totalViews"
            title="Total Views"
            color="#ec4899"
          />
          <AnalyticsChart
            data={userData.value.analyticsData || []}
            metric="uniqueViews"
            title="Unique Visitors"
            color="#8b5cf6"
          />
          <AnalyticsChart
            data={userData.value.analyticsData || []}
            metric="uploadsCount"
            title="New Uploads"
            color="#06b6d4"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div class="mb-6 sm:mb-8">
        <h2 class="text-xl sm:text-2xl font-bold text-gradient-cute mb-4 sm:mb-6 text-center flex items-center justify-center gap-2">
          Quick Actions
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Link
            href="/dashboard/uploads"
            class="card-cute p-4 sm:p-6 rounded-3xl group"
          >
            <div class="flex items-center mb-3 sm:mb-4">
              <div class="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full pulse-soft">
                <Folder class="w-5 sm:w-6 h-5 sm:h-6 text-white" />
              </div>
              <h3 class="ml-2 sm:ml-3 text-base sm:text-lg font-medium text-white group-hover:text-gradient-cute transition-all duration-300">
                File Manager
              </h3>
            </div>
            <p class="text-pink-200 text-xs sm:text-sm">
              View, manage, and organize all your uploaded files~ So many cute files! (｡♥‿♥｡)
            </p>
          </Link>

          <Link
            href="/dashboard/api-keys"
            class="card-cute p-4 sm:p-6 rounded-3xl group"
          >
            <div class="flex items-center mb-3 sm:mb-4">
              <div class="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full pulse-soft" style="animation-delay: 0.2s;">
                <Key class="w-5 sm:w-6 h-5 sm:h-6 text-white" />
              </div>
              <h3 class="ml-2 sm:ml-3 text-base sm:text-lg font-medium text-white group-hover:text-gradient-cute transition-all duration-300">
                API Keys
              </h3>
            </div>
            <p class="text-pink-200 text-xs sm:text-sm">
              Create and manage API keys for ShareX integration~ Keep them safe! (◡ ‿ ◡) ♡
            </p>
          </Link>

          <Link
            href="/dashboard/embed"
            class="card-cute p-4 sm:p-6 rounded-3xl group"
          >
            <div class="flex items-center mb-3 sm:mb-4">
              <div class="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full pulse-soft" style="animation-delay: 0.4s;">
                <Share class="w-5 sm:w-6 h-5 sm:h-6 text-white" />
              </div>
              <h3 class="ml-2 sm:ml-3 text-base sm:text-lg font-medium text-white group-hover:text-gradient-cute transition-all duration-300">
                Discord Embeds
              </h3>
            </div>
            <p class="text-pink-200 text-xs sm:text-sm">
              Customize how your uploads appear on Discord and social media~ Make them extra cute! uwu
            </p>
          </Link>

          <Link
            href="/setup/sharex"
            class="card-cute p-4 sm:p-6 rounded-3xl group"
          >
            <div class="flex items-center mb-3 sm:mb-4">
              <div class="p-2 sm:p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-full pulse-soft" style="animation-delay: 0.6s;">
                <Settings class="w-5 sm:w-6 h-5 sm:h-6 text-white" />
              </div>
              <h3 class="ml-2 sm:ml-3 text-base sm:text-lg font-medium text-white group-hover:text-gradient-cute transition-all duration-300">
                ShareX Setup
              </h3>
            </div>
            <p class="text-pink-200 text-xs sm:text-sm">
              Download your personalized ShareX configuration~ So easy even a sleepy catboy could do it! (=^･ω･^=)
            </p>
          </Link>
        </div>
      </div>
      {/* Recent Uploads */}
      <div class="card-cute rounded-3xl p-4 sm:p-6">
        <h2 class="text-lg sm:text-xl font-bold text-gradient-cute mb-4 flex items-center gap-2">
          Recent Uploads
        </h2>
        {userData.value.user.uploads.length > 0 ? (
          <div class="space-y-3">
            {userData.value.user.uploads.map((upload) => (
              <div key={upload.id} class="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 glass rounded-2xl space-y-3 sm:space-y-0">
                <div class="flex items-center space-x-3">
                  <div class="flex-shrink-0">
                    {upload.mimeType.startsWith('image/') ? (
                      <div
                        class="w-12 h-12 rounded-xl overflow-hidden border border-pink-300/30 hover:border-pink-300/60 transition-all duration-300 cursor-pointer" onClick$={() => handleImageClick(upload.shortCode, upload.originalName)}
                      >
                        <img
                          src={`/f/${upload.shortCode}`}
                          alt={upload.originalName}
                          class="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                          width="48"
                          height="48"
                        />
                      </div>
                    ) : upload.mimeType.startsWith('video/') ? (
                      <div class="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center pulse-soft">
                        <div class="text-lg">🎬</div>
                      </div>
                    ) : upload.mimeType.startsWith('audio/') ? (
                      <div class="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center pulse-soft">
                        <div class="text-lg">🎵</div>
                      </div>
                    ) : upload.mimeType.includes('pdf') ? (
                      <div class="w-12 h-12 bg-gradient-to-br from-red-600 to-red-500 rounded-xl flex items-center justify-center pulse-soft">
                        <div class="text-lg">📄</div>
                      </div>
                    ) : upload.mimeType.includes('zip') || upload.mimeType.includes('rar') || upload.mimeType.includes('archive') ? (
                      <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center pulse-soft">
                        <div class="text-lg">📦</div>
                      </div>
                    ) : upload.mimeType.includes('text') ? (
                      <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center pulse-soft">
                        <div class="text-lg">📝</div>
                      </div>
                    ) : (
                      <div class="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center pulse-soft">
                        <div class="text-lg">📄</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <p class="text-white font-medium">{upload.originalName}</p>
                    <p class="text-pink-200 text-sm">
                      {upload.views} views • {new Date(upload.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div class="flex space-x-2">
                  <a
                    href={`/f/${upload.shortCode}`}
                    target="_blank"
                    class="text-pink-400 hover:text-pink-300 text-sm px-3 py-1 rounded-full hover:bg-white/10 transition-all duration-300 text-center"
                  >
                    View <Eye class="inline w-4 h-4" />
                  </a>                  <button
                    onClick$={() => copyToClipboard(upload.shortCode)}
                    class="text-pink-200 hover:text-white text-sm px-3 py-1 rounded-full hover:bg-white/10 transition-all duration-300"
                  >
                    Copy URL <File class="inline w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div class="text-center py-12">
            <div class="text-6xl mb-4 sparkle">🌸</div>
            <p class="text-pink-200 mb-6 text-lg">No uploads yet~ Time to share some cute files!</p>
            <a
              href="/setup/sharex"
              class="btn-cute text-white px-6 py-3 rounded-full font-medium inline-block"
            >
              Setup ShareX to get started 🚀
            </a>
          </div>
        )}
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "Dashboard - twink.forsale 💕",
  meta: [
    {
      name: "description",
      content: "Your kawaii dashboard! Manage uploads, API keys, and all your cute files~ uwu",
    },
  ],
};
