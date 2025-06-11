import { component$ } from "@builder.io/qwik";
import { Form, Link, useLocation, routeLoader$ } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useSession, useSignIn } from "~/routes/plugin@auth";
import { Home, Settings, User, Rocket, Heart, BarChart3, Sparkle, Wrench, FileText, Eye, Upload, Users } from "lucide-icons-qwik";

export const usePublicStats = routeLoader$(async () => {
  // Import server-side dependencies inside the loader
  const { db } = await import("~/lib/db");
  const { getAnalyticsData } = await import("~/lib/analytics");

  try {
    // Get total counts
    const totalUploads = await db.upload.count();
    const totalViews = await db.upload.aggregate({
      _sum: { views: true }
    });
    const totalUsers = await db.user.count();

    // Get analytics data for the last 7 days
    const analyticsData = await getAnalyticsData(7);

    // Calculate 7-day totals
    const weeklyStats = analyticsData.reduce(
      (acc, day) => ({
        views: acc.views + day.totalViews,
        uploads: acc.uploads + day.uploadsCount,
        users: acc.users + day.usersRegistered,
      }),
      { views: 0, uploads: 0, users: 0 }
    );

    // Get recent upload activity (anonymized)
    const recentUploads = await db.upload.findMany({
      select: {
        id: true,
        createdAt: true,
        mimeType: true,
        views: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    return {
      totalUploads,
      totalViews: totalViews._sum.views || 0,
      totalUsers,
      weeklyStats,
      analyticsData,
      recentUploads
    };
  } catch (error) {
    console.error('Error fetching public stats:', error);
    return {
      totalUploads: 0,
      totalViews: 0,
      totalUsers: 0,
      weeklyStats: { views: 0, uploads: 0, users: 0 },
      analyticsData: [],
      recentUploads: []
    };
  }
});

export default component$(() => {
  const session = useSession();
  const signIn = useSignIn();
  const loc = useLocation();
  const publicStats = usePublicStats();

  return (
    <>
      {/* Hero Section */}
      <div class="relative overflow-hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-24">
          <div class="text-center">
            <h1 class="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              Cute femboy
              <span class="text-gradient-cute block sm:inline">
                {" "}File Sharing
              </span>
            </h1>
            <p class="text-lg sm:text-xl text-pink-200 mb-6 sm:mb-8 max-w-3xl mx-auto px-2">
              Upload and share files with the cutest, most uwu file sharing service ever!
              I made this 80% with ai cuz i could (´｡• ᵕ •｡`) ♡
            </p>
            {session.value ? (
              <div class="flex flex-col sm:flex-row gap-4 justify-center items-center px-4">
                <Link
                  href="/dashboard"
                  class="btn-cute text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Home class="w-5 h-5" />
                  Go to Dashboard
                </Link>
                <Link
                  href="/setup/sharex"
                  class="glass text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Settings class="w-5 h-5" />
                  Setup ShareX
                </Link>
              </div>
            ) : (
              <Form action={signIn} q:slot='end'>
                <input type="hidden" name="providerId" value="discord" />
                <input
                  type="hidden"
                  name="options.redirectTo"
                  value={loc.url.pathname + loc.url.search}
                />                <button class="btn-cute text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold flex items-center justify-center gap-2 w-full sm:w-auto max-w-xs mx-auto">
                  <User class="w-5 h-5" />
                  Get Started
                </button>
              </Form>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div class="py-12 sm:py-24 relative">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 class="text-2xl sm:text-3xl font-bold text-center text-white mb-4 text-gradient-cute flex items-center justify-center gap-2 flex-wrap">
            Why Choose twink.forsale?
            <Sparkle class="w-6 sm:w-8 h-6 sm:h-8" />
          </h2>
          <p class="text-center text-pink-200 px-4">Because we're the cutest file hosting uwu</p>
          <p class="text-center text-gray-500 mb-8 sm:mb-16 px-4">Do note this is a private/application only site, hit me up on discord @akiradev to ask for access</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div class="card-cute p-8 rounded-3xl">
              <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mb-6">
                <Rocket class="w-8 h-8 text-white" />
              </div>
              <h3 class="text-xl font-semibold text-white mb-3">Femboy Certified ✓</h3>
              <p class="text-pink-200">
                Gay femboy approved file sharing with a focus on simplicity, speed, and maximum cuteness! (◕‿◕)♡
              </p>
            </div>
            <div class="card-cute p-8 rounded-3xl">
              <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full flex items-center justify-center mb-6" style="animation-delay: 0.5s;">
                <Heart class="w-8 h-8 text-white" />
              </div>
              <h3 class="text-xl font-semibold text-white mb-3">Super Secure uwu</h3>
              <p class="text-pink-200">
                Your files are protected with love and care~ (´｡• ᵕ •｡`) ♡
              </p>
            </div>
            <div class="card-cute p-8 rounded-3xl">
              <div class="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center mb-6" style="animation-delay: 1s;">
                <BarChart3 class="w-8 h-8 text-white" />
              </div>
              <h3 class="text-xl font-semibold text-white mb-3">Analytics & Stats</h3>
              <p class="text-pink-200">
                Track views, manage your uploads, and monitor your storage usage with our amazeballs dashboard! (=^･ω･^=)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Stats Section */}
      <div class="py-12 sm:py-16 relative">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 class="text-2xl sm:text-3xl font-bold text-center text-white mb-4 text-gradient-cute flex items-center justify-center gap-2 flex-wrap">
            Platform Activity
            <BarChart3 class="w-6 sm:w-8 h-6 sm:h-8" />
            <Sparkle class="w-5 sm:w-6 h-5 sm:h-6" />
          </h2>
          <p class="text-center text-pink-200 mb-8 sm:mb-12 px-4">
            See how active our twinks are~ (◕‿◕)♡
          </p>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {/* Total Stats */}
            <div class="card-cute p-4 sm:p-6 rounded-3xl text-center">
              <div class="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Upload class="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div class="text-lg sm:text-2xl font-bold text-white mb-1">
                {publicStats.value.totalUploads.toLocaleString()}
              </div>
              <div class="text-xs sm:text-sm text-pink-200">Total Files</div>
            </div>

            <div class="card-cute p-4 sm:p-6 rounded-3xl text-center">
              <div class="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Eye class="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div class="text-lg sm:text-2xl font-bold text-white mb-1">
                {publicStats.value.totalViews.toLocaleString()}
              </div>
              <div class="text-xs sm:text-sm text-pink-200">Total Views</div>
            </div>

            <div class="card-cute p-4 sm:p-6 rounded-3xl text-center">
              <div class="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Users class="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div class="text-lg sm:text-2xl font-bold text-white mb-1">
                {publicStats.value.totalUsers.toLocaleString()}
              </div>
              <div class="text-xs sm:text-sm text-pink-200">Twinks</div>
            </div>

            <div class="card-cute p-4 sm:p-6 rounded-3xl text-center">
              <div class="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Sparkle class="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div class="text-lg sm:text-2xl font-bold text-white mb-1">
                {publicStats.value.weeklyStats.views.toLocaleString()}
              </div>
              <div class="text-xs sm:text-sm text-pink-200">Views (7d)</div>
            </div>
          </div>

          {/* Activity Chart */}
          {publicStats.value.analyticsData.length > 0 && (
            <div class="glass rounded-3xl p-4 sm:p-8 max-w-4xl mx-auto">
              <h3 class="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 text-center flex items-center justify-center gap-2">
                <BarChart3 class="w-5 h-5" />
                7-Day Activity Overview
              </h3>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {/* Mini Activity Charts */}
                <div class="text-center">
                  <div class="text-sm font-medium text-pink-200 mb-2">Daily Views</div>
                  <div class="h-16 sm:h-20 flex items-end justify-center gap-1">
                    {publicStats.value.analyticsData.map((day, index) => {
                      const maxViews = Math.max(...publicStats.value.analyticsData.map(d => d.totalViews), 1);
                      const height = Math.max((day.totalViews / maxViews) * 100, 5);
                      return (
                        <div
                          key={index}
                          class="bg-gradient-to-t from-pink-500 to-purple-500 rounded-sm w-3 sm:w-4"
                          style={`height: ${height}%`}
                          title={`${day.date}: ${day.totalViews} views`}
                        />
                      );
                    })}
                  </div>
                  <div class="text-lg font-bold text-white mt-2">
                    {publicStats.value.weeklyStats.views}
                  </div>
                </div>

                <div class="text-center">
                  <div class="text-sm font-medium text-pink-200 mb-2">Daily Uploads</div>
                  <div class="h-16 sm:h-20 flex items-end justify-center gap-1">
                    {publicStats.value.analyticsData.map((day, index) => {
                      const maxUploads = Math.max(...publicStats.value.analyticsData.map(d => d.uploadsCount), 1);
                      const height = Math.max((day.uploadsCount / maxUploads) * 100, 5);
                      return (
                        <div
                          key={index}
                          class="bg-gradient-to-t from-cyan-500 to-blue-500 rounded-sm w-3 sm:w-4"
                          style={`height: ${height}%`}
                          title={`${day.date}: ${day.uploadsCount} uploads`}
                        />
                      );
                    })}
                  </div>
                  <div class="text-lg font-bold text-white mt-2">
                    {publicStats.value.weeklyStats.uploads}
                  </div>
                </div>

                <div class="text-center">
                  <div class="text-sm font-medium text-pink-200 mb-2">New Users</div>
                  <div class="h-16 sm:h-20 flex items-end justify-center gap-1">
                    {publicStats.value.analyticsData.map((day, index) => {
                      const maxUsers = Math.max(...publicStats.value.analyticsData.map(d => d.usersRegistered), 1);
                      const height = Math.max((day.usersRegistered / maxUsers) * 100, 5);
                      return (
                        <div
                          key={index}
                          class="bg-gradient-to-t from-green-500 to-emerald-500 rounded-sm w-3 sm:w-4"
                          style={`height: ${height}%`}
                          title={`${day.date}: ${day.usersRegistered} new users`}
                        />
                      );
                    })}
                  </div>
                  <div class="text-lg font-bold text-white mt-2">
                    {publicStats.value.weeklyStats.users}
                  </div>
                </div>              </div>
            </div>
          )}

          {/* Recent Activity Feed */}
          {publicStats.value.recentUploads.length > 0 && (
            <div class="glass rounded-3xl p-4 sm:p-6 max-w-2xl mx-auto mt-8 sm:mt-12">
              <h3 class="text-lg font-bold text-white mb-4 text-center flex items-center justify-center gap-2">
                <Sparkle class="w-5 h-5" />
                Recent Activity
              </h3>              <div class="space-y-3">
                {publicStats.value.recentUploads.map((upload) => {
                  const getFileIcon = (mimeType: string) => {
                    if (mimeType.startsWith('image/')) return '🖼️';
                    if (mimeType.startsWith('video/')) return '🎥';
                    if (mimeType.startsWith('audio/')) return '🎵';
                    if (mimeType.startsWith('text/')) return '📝';
                    return '📄';
                  };

                  const getFileType = (mimeType: string) => {
                    if (mimeType.startsWith('image/')) return 'Image';
                    if (mimeType.startsWith('video/')) return 'Video';
                    if (mimeType.startsWith('audio/')) return 'Audio';
                    if (mimeType.startsWith('text/')) return 'Text';
                    return 'File';
                  }; const timeAgo = (date: Date) => {
                    const now = new Date();
                    const uploadDate = new Date(date);
                    const diffInMinutes = Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60));

                    if (diffInMinutes < 1) return 'Just now';
                    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
                    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
                    return `${Math.floor(diffInMinutes / 1440)}d ago`;
                  };

                  return (
                    <div key={upload.id} class="flex items-center justify-between p-3 glass rounded-xl border border-pink-300/20">
                      <div class="flex items-center gap-3">
                        <span class="text-lg">{getFileIcon(upload.mimeType)}</span>
                        <div>
                          <div class="text-sm text-white font-medium">
                            {getFileType(upload.mimeType)} uploaded
                          </div>
                          <div class="text-xs text-pink-300">
                            {timeAgo(upload.createdAt)} • {upload.views} views
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-1">
                        <Eye class="w-3 h-3 text-pink-300" />
                        <span class="text-xs text-pink-300">{upload.views}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ShareX Setup Section */}
      <div class="py-12 sm:py-24 relative">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4 text-gradient-cute flex items-center justify-center gap-2 flex-wrap">
            Super Easy ShareX Setup!
            <Wrench class="w-6 sm:w-8 h-6 sm:h-8" />
            <Sparkle class="w-5 sm:w-6 h-5 sm:h-6" />
          </h2>
          <p class="text-lg sm:text-xl text-pink-200 mb-8 sm:mb-12 px-2">
            Set up ShareX in seconds with our automatic configuration generator~ So easy even a catboy could do it! (=^･ω･^=)
          </p>
          <div class="glass rounded-3xl p-4 sm:p-8">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-left">
              <div class="flex items-start space-x-3 sm:space-x-4">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg pulse-soft flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 class="font-semibold text-white mb-2 flex items-center gap-2 text-sm sm:text-base">
                    <User class="w-4 h-4" />
                    Sign In
                  </h3>
                  <p class="text-pink-200 text-xs sm:text-sm">Create your account with Discord~ It's quick and easy!</p>
                </div>
              </div>
              <div class="flex items-start space-x-3 sm:space-x-4">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg pulse-soft flex-shrink-0" style="animation-delay: 0.5s;">
                  2
                </div>
                <div>
                  <h3 class="font-semibold text-white mb-2 flex items-center gap-2 text-sm sm:text-base">
                    <FileText class="w-4 h-4" />
                    Download Config
                  </h3>
                  <p class="text-pink-200 text-xs sm:text-sm">Get your personalized ShareX configuration file</p>
                </div>
              </div>
              <div class="flex items-start space-x-3 sm:space-x-4">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg pulse-soft flex-shrink-0" style="animation-delay: 1s;">
                  3
                </div>
                <div>
                  <h3 class="font-semibold text-white mb-2 flex items-center gap-2 text-sm sm:text-base">
                    <Rocket class="w-4 h-4" />
                    Start Sharing!
                  </h3>
                  <p class="text-pink-200 text-xs sm:text-sm">Upload files instantly with ShareX uwu</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "twink.forsale - Cutest File Sharing Ever! 💕",
  meta: [
    {
      name: "description",
      content: "The most amazing file sharing service! Upload and share files with adorable ShareX integration. Made with love by femboys for everyone~ uwu",
    },
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1.0",
    },
    {
      property: "og:title",
      content: "twink.forsale - Cutest File Sharing Ever! 💕",
    },
    {
      property: "og:description",
      content: "The most mrrrp file sharing service! Upload and share files with adorable ShareX integration uwu",
    },
  ],
};
