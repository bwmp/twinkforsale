import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import {
  Activity,
  Server,
  Database,
  HardDrive,
  Users,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Zap,
  Eye,
  Download,
  FileText,
  Cpu,
  RefreshCw,
  Info,
} from "lucide-icons-qwik";
import { formatBytes } from "~/lib/utils";

export const useAdminCheck = routeLoader$(async (requestEvent) => {
  const { db } = await import("~/lib/db");

  const session = requestEvent.sharedMap.get("session");

  if (!session?.user?.email) {
    throw requestEvent.redirect(302, "/");
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    throw requestEvent.redirect(302, "/dashboard");
  }
  return { isAdmin: true };
});

// Server action to trigger system checks from health dashboard
export const useTriggerSystemCheck = routeAction$(
  async (data, requestEvent) => {
    const { db } = await import("~/lib/db");
    const { checkSystemAlerts, checkUserStorageAlerts } = await import(
      "~/lib/system-events"
    );

    const session = requestEvent.sharedMap.get("session");
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return { success: false, error: "Admin access required" };
    }

    try {
      await checkSystemAlerts();

      const users = await db.user.findMany({
        select: { id: true },
      });

      for (const user of users) {
        await checkUserStorageAlerts(user.id);
      }

      return { success: true, message: `System check completed` };
    } catch (error) {
      console.error("System check error:", error);
      return { success: false, error: "Failed to run system check" };
    }
  },
);

export const useHealthData = routeLoader$(async () => {
  const { db } = await import("~/lib/db");
  const { getEnvConfig } = await import("~/lib/env");
  const { getAnalyticsData } = await import("~/lib/analytics");
  const { getDiskUsage, getFreeSpace } = await import("~/lib/utils");
  const { getRecentSystemEvents, getSystemEventsStats } = await import(
    "~/lib/system-events"
  );
  const os = await import("os");

  const config = getEnvConfig();

  try {
    // Database Health
    const dbStart = Date.now();
    await db.user.count();
    const dbResponseTime = Date.now() - dbStart;

    // Storage Analytics
    const uploadsDir = config.UPLOAD_DIR;
    const storageStats = {
      totalFiles: 0,
      totalSize: 0,
      freeSpace: 0,
      usedSpace: 0,
      diskTotal: 0,
      diskUsed: 0,
      diskUsedPercentage: 0,
    };

    try {
      const totalUploads = await db.upload.count();
      const totalSize = await db.upload.aggregate({
        _sum: { size: true },
      });

      storageStats.totalFiles = totalUploads;
      storageStats.totalSize = totalSize._sum.size || 0;

      // Get actual disk usage information
      const diskUsage = await getDiskUsage(uploadsDir);
      storageStats.freeSpace = diskUsage.free;
      storageStats.diskTotal = diskUsage.total;
      storageStats.diskUsed = diskUsage.used;
      storageStats.diskUsedPercentage = diskUsage.usedPercentage;
      storageStats.usedSpace = storageStats.totalSize;
    } catch (error) {
      console.error("Storage stats error:", error);
      // Fallback to getting just free space
      try {
        storageStats.freeSpace = await getFreeSpace(uploadsDir);
      } catch (freeSpaceError) {
        console.error("Free space error:", freeSpaceError);
        storageStats.freeSpace = 100 * 1024 * 1024 * 1024; // 100GB fallback
      }
    }

    // User Statistics
    const totalUsers = await db.user.count();
    const approvedUsers = await db.user.count({
      where: { isApproved: true },
    });
    const pendingUsers = totalUsers - approvedUsers;

    // Recent Activity (last 24 hours)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUploads = await db.upload.count({
      where: { createdAt: { gte: last24h } },
    });
    const recentViews = await db.viewLog.count({
      where: { viewedAt: { gte: last24h } },
    });
    const recentDownloads = await db.downloadLog.count({
      where: { downloadedAt: { gte: last24h } },
    });

    // System Performance
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    const availableMemory = process.availableMemory();
    const uptime = process.uptime();

    // Top Active Users (last 7 days)
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const topUsers = await db.user.findMany({
      include: {
        uploads: {
          where: { createdAt: { gte: last7Days } },
        },
        _count: {
          select: {
            uploads: true,
          },
        },
      },
      orderBy: {
        uploads: {
          _count: "desc",
        },
      },
      take: 5,
    });

    // Error Logs (simulate - in a real app you'd have proper error logging)
    const errorLogs = [
      {
        timestamp: new Date(Date.now() - 7200000),
        level: "info",
        message: "placeholder",
        source: "cleanup-task",
      },
    ]; // Analytics for the last 7 days
    const analyticsData = await getAnalyticsData(7);

    // System Events (last 24 hours)
    const recentEvents = await getRecentSystemEvents(20);
    const eventStats = await getSystemEventsStats(24);

    return {
      database: {
        status: "healthy",
        responseTime: dbResponseTime,
        connections: 1, // SQLite doesn't have connection pooling
      },
      storage: storageStats,
      users: {
        total: totalUsers,
        approved: approvedUsers,
        pending: pendingUsers,
      },
      activity: {
        uploads24h: recentUploads,
        views24h: recentViews,
        downloads24h: recentDownloads,
      },
      system: {
        uptime: Math.floor(uptime),
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          available: Math.round(availableMemory / 1024 / 1024),
        },
        cpu: cpuUsage,
        platform: os.platform(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development",
      },
      topUsers: topUsers.map((user) => ({
        name: user.name || "Anonymous",
        email: user.email,
        uploadsLast7Days: user.uploads.length,
        totalUploads: user._count.uploads,
        storageUsed: user.storageUsed,
      })),
      errorLogs,
      analytics: analyticsData,
      systemEvents: {
        recent: recentEvents,
        stats: eventStats,
      },
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error("Health check error:", error);
    return {
      error: "Failed to collect health data",
      lastUpdated: new Date(),
    };
  }
});

export default component$(() => {
  const healthData = useHealthData();
  const triggerSystemCheckAction = useTriggerSystemCheck();
  const autoRefresh = useSignal(false);
  // Auto-refresh functionality
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }: any) => {
    track(() => autoRefresh.value);

    if (autoRefresh.value) {
      const interval = setInterval(() => {
        window.location.reload();
      }, 30000); // Refresh every 30 seconds

      cleanup(() => clearInterval(interval));
    }
  });
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (healthData.value.error) {
    return (
      <div class="min-h-screen p-4 sm:p-6">
        <div class="mx-auto max-w-7xl">
          <div class="text-center">
            <AlertTriangle class="mx-auto h-12 w-12 text-red-500" />
            <h1 class="mt-4 text-2xl font-bold text-red-500">
              Health Check Failed
            </h1>
            <p class="mt-2 text-gray-600">{healthData.value.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const data = healthData.value;

  return (
    <div class="min-h-screen p-4 sm:p-6">
      <div class="mx-auto max-w-7xl">
        {/* Header */}
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h1 class="text-gradient-cute flex items-center gap-3 text-3xl font-bold">
              <Activity class="h-8 w-8" />
              Health Dashboard
            </h1>
            <p class="text-theme-secondary mt-2">
              Real-time system monitoring and performance metrics~ 📊
            </p>
          </div>{" "}
          <div class="flex items-center gap-4">
            <button
              onClick$={() => (autoRefresh.value = !autoRefresh.value)}
              class={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                autoRefresh.value
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <RefreshCw
                class={`h-4 w-4 ${autoRefresh.value ? "animate-spin" : ""}`}
              />
              Auto Refresh
            </button>{" "}
            <button
              onClick$={async () => {
                const result = await triggerSystemCheckAction.submit();
                if (result.value?.success) {
                  setTimeout(() => window.location.reload(), 1000);
                } else {
                  console.error(
                    "Failed to trigger system check:",
                    result.value?.error,
                  );
                }
              }}
              class="btn-secondary flex items-center gap-2"
            >
              <Info class="h-4 w-4" />
              Check Events
            </button>
            <button
              onClick$={() => window.location.reload()}
              class="btn-secondary flex items-center gap-2"
            >
              <RefreshCw class="h-4 w-4" />
              Refresh Now
            </button>
          </div>
        </div>
        {/* Status Overview */}
        <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Database Status */}
          <div class="card-cute rounded-2xl p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Database class="h-6 w-6 text-blue-500" />
                <div>
                  <h3 class="font-medium">Database</h3>
                  <p class="text-sm text-gray-600">
                    {data.database?.responseTime}ms response
                  </p>
                </div>
              </div>
              <CheckCircle class="h-5 w-5 text-green-500" />
            </div>
          </div>{" "}
          {/* Storage Status */}
          <div class="card-cute rounded-2xl p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <HardDrive class="h-6 w-6 text-purple-500" />
                <div>
                  <h3 class="font-medium">Storage</h3>
                  <p class="text-sm text-gray-600">
                    {formatBytes(data.storage?.freeSpace || 0)} free
                    {data.storage?.diskUsedPercentage && (
                      <span class="ml-1">
                        ({(100 - data.storage.diskUsedPercentage).toFixed(1)}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {data.storage?.diskUsedPercentage &&
              data.storage.diskUsedPercentage > 80 ? (
                <AlertTriangle class="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle class="h-5 w-5 text-green-500" />
              )}
            </div>
          </div>
          {/* Users Status */}
          <div class="card-cute rounded-2xl p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Users class="h-6 w-6 text-green-500" />
                <div>
                  <h3 class="font-medium">Users</h3>
                  <p class="text-sm text-gray-600">
                    {data.users?.pending || 0} pending approval
                  </p>
                </div>
              </div>
              {(data.users?.pending || 0) > 0 ? (
                <AlertTriangle class="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle class="h-5 w-5 text-green-500" />
              )}
            </div>
          </div>
          {/* System Status */}
          <div class="card-cute rounded-2xl p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Server class="h-6 w-6 text-indigo-500" />
                <div>
                  <h3 class="font-medium">System</h3>
                  <p class="text-sm text-gray-600">
                    Uptime: {formatUptime(data.system?.uptime || 0)}
                  </p>
                </div>
              </div>
              <CheckCircle class="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>
        {/* Key Metrics */}
        <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* System Performance */}
          <div class="card-cute rounded-3xl p-6">
            <h3 class="text-gradient-cute mb-4 flex items-center gap-2 text-lg font-bold">
              <Cpu class="h-5 w-5" />
              System Performance
            </h3>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-theme-text-secondary">Memory Usage</span>
                <span class="font-medium">
                  {data.system?.memory.used}MB / {data.system?.memory.total}MB
                </span>
              </div>
              <div class="bg-theme-card-border h-2 overflow-hidden rounded-full">
                <div
                  class="bg-gradient-theme-primary-secondary h-full transition-all duration-500"
                  style={{
                    width: `${
                      data.system?.memory.used && data.system?.memory.total
                        ? (data.system.memory.used / data.system.memory.total) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div class="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span class="text-theme-text-secondary text-sm">
                    External Memory
                  </span>
                  <p class="font-medium">{data.system?.memory.available}MB</p>
                </div>
                <div>
                  <span class="text-theme-text-secondary text-sm">
                    Node Version
                  </span>
                  <p class="font-medium">{data.system?.nodeVersion}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Metrics */}
          <div class="card-cute rounded-3xl p-6">
            <h3 class="text-gradient-cute mb-4 flex items-center gap-2 text-lg font-bold">
              <TrendingUp class="h-5 w-5" />
              24h Activity
            </h3>
            <div class="grid grid-cols-3 gap-4">
              <div class="text-center">
                <div class="bg-gradient-theme-primary-secondary mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                  <FileText class="h-6 w-6 text-white" />
                </div>
                <div class="text-theme-primary text-2xl font-bold">
                  {data.activity?.uploads24h || 0}
                </div>
                <div class="text-theme-text-secondary text-sm">Uploads</div>
              </div>
              <div class="text-center">
                <div class="bg-gradient-theme-secondary-tertiary mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                  <Eye class="h-6 w-6 text-white" />
                </div>
                <div class="text-theme-primary text-2xl font-bold">
                  {data.activity?.views24h || 0}
                </div>
                <div class="text-theme-text-secondary text-sm">Views</div>
              </div>
              <div class="text-center">
                <div class="bg-gradient-theme-tertiary-quaternary mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                  <Download class="h-6 w-6 text-white" />
                </div>
                <div class="text-theme-primary text-2xl font-bold">
                  {data.activity?.downloads24h || 0}
                </div>
                <div class="text-theme-text-secondary text-sm">Downloads</div>
              </div>
            </div>
          </div>
        </div>
        {/* Storage & User Analytics */}
        <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {" "}
          {/* Storage Breakdown */}
          <div class="card-cute rounded-3xl p-6">
            <h3 class="text-gradient-cute mb-4 flex items-center gap-2 text-lg font-bold">
              <HardDrive class="h-5 w-5" />
              Storage Analytics
            </h3>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-theme-text-secondary">Total Files</span>
                <span class="font-medium">
                  {data.storage?.totalFiles?.toLocaleString() || 0}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-theme-text-secondary">Files Size</span>
                <span class="font-medium">
                  {formatBytes(data.storage?.totalSize || 0)}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-theme-text-secondary">Disk Free Space</span>
                <span class="font-medium text-green-600">
                  {formatBytes(data.storage?.freeSpace || 0)}
                </span>
              </div>
              {data.storage?.diskTotal && data.storage.diskTotal > 0 && (
                <>
                  <div class="flex items-center justify-between">
                    <span class="text-theme-text-secondary">
                      Total Disk Size
                    </span>
                    <span class="font-medium">
                      {formatBytes(data.storage.diskTotal)}
                    </span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-theme-text-secondary">Disk Usage</span>
                    <span class="font-medium">
                      {data.storage.diskUsedPercentage?.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div class="bg-theme-card-border h-3 overflow-hidden rounded-full">
                    <div
                      class={`h-full transition-all duration-500 ${
                        (data.storage.diskUsedPercentage || 0) > 80
                          ? "bg-gradient-to-r from-red-500 to-red-600"
                          : (data.storage.diskUsedPercentage || 0) > 60
                            ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                            : "bg-gradient-to-r from-green-500 to-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(data.storage.diskUsedPercentage || 0, 100)}%`,
                      }}
                    />
                  </div>
                </>
              )}
              <div class="flex items-center justify-between">
                <span class="text-theme-text-secondary">Average File Size</span>
                <span class="font-medium">
                  {data.storage?.totalFiles && data.storage?.totalSize
                    ? formatBytes(
                        Math.round(
                          data.storage.totalSize / data.storage.totalFiles,
                        ),
                      )
                    : "0 Bytes"}
                </span>
              </div>
            </div>
          </div>
          {/* User Statistics */}
          <div class="card-cute rounded-3xl p-6">
            <h3 class="text-gradient-cute mb-4 flex items-center gap-2 text-lg font-bold">
              <Users class="h-5 w-5" />
              User Statistics
            </h3>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-theme-text-secondary">Total Users</span>
                <span class="font-medium">{data.users?.total || 0}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-theme-text-secondary">Approved Users</span>
                <span class="font-medium text-green-600">
                  {data.users?.approved || 0}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-theme-text-secondary">Pending Approval</span>
                <span
                  class={`font-medium ${
                    (data.users?.pending || 0) > 0
                      ? "text-yellow-600"
                      : "text-gray-600"
                  }`}
                >
                  {data.users?.pending || 0}
                </span>
              </div>
              <div class="bg-theme-card-border h-2 overflow-hidden rounded-full">
                <div
                  class="bg-gradient-theme-success h-full transition-all duration-500"
                  style={{
                    width: `${
                      data.users?.total && data.users?.approved
                        ? (data.users.approved / data.users.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        {/* Top Active Users */}
        <div class="mb-6">
          <div class="card-cute rounded-3xl p-6">
            <h3 class="text-gradient-cute mb-4 flex items-center gap-2 text-lg font-bold">
              <Zap class="h-5 w-5" />
              Top Active Users (Last 7 Days)
            </h3>
            {data.topUsers && data.topUsers.length > 0 ? (
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="border-theme-card-border border-b">
                      <th class="text-theme-text-secondary py-2 text-left text-sm font-medium">
                        User
                      </th>
                      <th class="text-theme-text-secondary py-2 text-right text-sm font-medium">
                        Recent Uploads
                      </th>
                      <th class="text-theme-text-secondary py-2 text-right text-sm font-medium">
                        Total Uploads
                      </th>
                      <th class="text-theme-text-secondary py-2 text-right text-sm font-medium">
                        Storage Used
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.map((user, index) => (
                      <tr
                        key={index}
                        class="border-theme-card-border border-b last:border-b-0"
                      >
                        <td class="py-3">
                          <div>
                            <div class="font-medium">{user.name}</div>
                            <div class="text-theme-text-secondary text-sm">
                              {user.email}
                            </div>
                          </div>
                        </td>
                        <td class="text-theme-primary text-right font-medium">
                          {user.uploadsLast7Days}
                        </td>
                        <td class="text-theme-text-secondary text-right">
                          {user.totalUploads}
                        </td>
                        <td class="text-theme-text-secondary text-right">
                          {formatBytes(user.storageUsed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div class="py-8 text-center">
                <Users class="mx-auto h-12 w-12 text-gray-400" />
                <p class="text-theme-text-secondary mt-2">
                  No recent user activity
                </p>
              </div>
            )}
          </div>
        </div>{" "}
        {/* System Events */}
        <div class="mb-6">
          <div class="card-cute rounded-3xl p-6">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-gradient-cute flex items-center gap-2 text-lg font-bold">
                <Info class="h-5 w-5" />
                System Events (Last 24h)
              </h3>
              <div class="flex gap-2 text-xs">
                {data.systemEvents?.stats && (
                  <>
                    {data.systemEvents.stats.CRITICAL && (
                      <span class="rounded bg-red-100 px-2 py-1 text-red-800">
                        {data.systemEvents.stats.CRITICAL} Critical
                      </span>
                    )}
                    {data.systemEvents.stats.ERROR && (
                      <span class="rounded bg-orange-100 px-2 py-1 text-orange-800">
                        {data.systemEvents.stats.ERROR} Errors
                      </span>
                    )}
                    {data.systemEvents.stats.WARNING && (
                      <span class="rounded bg-yellow-100 px-2 py-1 text-yellow-800">
                        {data.systemEvents.stats.WARNING} Warnings
                      </span>
                    )}
                    {data.systemEvents.stats.INFO && (
                      <span class="rounded bg-blue-100 px-2 py-1 text-blue-800">
                        {data.systemEvents.stats.INFO} Info
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            {data.systemEvents?.recent &&
            data.systemEvents.recent.length > 0 ? (
              <div class="max-h-96 space-y-3 overflow-y-auto">
                {data.systemEvents.recent.map((event, index) => (
                  <div
                    key={index}
                    class="border-theme-card-border flex items-start justify-between border-b pb-3 last:border-b-0"
                  >
                    <div class="flex items-start gap-3">
                      {event.severity === "CRITICAL" && (
                        <AlertTriangle class="mt-1 h-4 w-4 text-red-500" />
                      )}
                      {event.severity === "ERROR" && (
                        <AlertTriangle class="mt-1 h-4 w-4 text-orange-500" />
                      )}
                      {event.severity === "WARNING" && (
                        <AlertTriangle class="mt-1 h-4 w-4 text-yellow-500" />
                      )}
                      {event.severity === "INFO" && (
                        <Info class="mt-1 h-4 w-4 text-blue-500" />
                      )}
                      <div class="flex-1">
                        <div class="font-medium">{event.title}</div>
                        <div class="text-theme-text-secondary mt-1 text-sm">
                          {event.message}
                        </div>
                        {event.user && (
                          <div class="text-theme-text-secondary mt-1 text-xs">
                            User: {event.user.email}
                          </div>
                        )}{" "}
                        {event.metadata && (
                          <div class="text-theme-text-secondary mt-1 text-xs">
                            <details class="cursor-pointer">
                              <summary>View details</summary>
                              <pre class="bg-theme-card border-theme-card-border mt-1 overflow-x-auto rounded border p-2 text-xs">
                                {typeof event.metadata === "string"
                                  ? JSON.stringify(
                                      JSON.parse(event.metadata),
                                      null,
                                      2,
                                    )
                                  : JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>
                    <div class="text-theme-text-secondary text-sm">
                      {new Date(event.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div class="py-8 text-center">
                <CheckCircle class="mx-auto h-12 w-12 text-green-500" />
                <p class="text-theme-text-secondary mt-2">
                  No system events in the last 24 hours! 🎉
                </p>
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div class="text-center text-sm text-gray-500">
          <p>
            Last updated: {data.lastUpdated?.toLocaleString()} •{" "}
            {autoRefresh.value ? "Auto-refreshing every 30s" : "Manual refresh"}
          </p>
          <p class="mt-1">
            Environment: {data.system?.environment} • Platform:{" "}
            {data.system?.platform}
          </p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Health Dashboard - Admin - twink.forsale",
  meta: [
    {
      name: "description",
      content:
        "System health monitoring and performance metrics for twink.forsale",
    },
  ],
};
