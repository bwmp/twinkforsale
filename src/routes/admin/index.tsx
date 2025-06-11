import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$ } from "@builder.io/qwik-city";
import {
  Users,
  CheckCircle,
  Ban,
  Search,
  Filter,
  ArrowUpDown,
} from "lucide-icons-qwik";
import { AnalyticsChart } from "~/components/analytics-chart/analytics-chart";
import { UserAnalytics } from "~/components/user-analytics/user-analytics";

export const useUserData = routeLoader$(async ({ sharedMap, redirect }) => {
  // Import server-side dependencies inside the loader
  const { db } = await import("~/lib/db");
  const { getEnvConfig } = await import("~/lib/env");
  const { getAnalyticsData } = await import("~/lib/analytics");

  const session = sharedMap.get("session");

  if (!session?.user?.email) {
    throw redirect(302, "/");
  }

  // Find user and verify admin status
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, isAdmin: true },
  });

  if (!user?.isAdmin) {
    throw redirect(302, "/dashboard");
  } // Get all users with their approval status and Discord account info
  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      isApproved: true,
      isAdmin: true,
      approvedAt: true,
      maxUploads: true,
      maxFileSize: true,
      maxStorageLimit: true,
      storageUsed: true,
      approvedBy: {
        select: {
          name: true,
          email: true,
        },
      },
      accounts: {
        select: {
          provider: true,
          providerAccountId: true,
        },
        where: {
          provider: "discord",
        },
      },
      _count: {
        select: {
          uploads: true,
          apiKeys: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const config = getEnvConfig();

  // Get analytics data for the last week
  const analyticsData = await getAnalyticsData(7);

  return { users, currentUser: user, config, analyticsData };
});

export const useUpdateUser = routeAction$(async (data, { sharedMap }) => {
  // Import server-side dependencies inside the action
  const { db } = await import("~/lib/db");

  const session = sharedMap.get("session");

  if (!session?.user?.email) {
    return { success: false, error: "Authentication required" };
  }

  // Verify admin status
  const admin = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, isAdmin: true },
  });

  if (!admin?.isAdmin) {
    return { success: false, error: "Admin access required" };
  }

  if (!data.userId) {
    return { success: false, error: "userId is required" };
  }
  // Update user
  const updateData: any = {};

  if (typeof data.isApproved === "boolean") {
    updateData.isApproved = data.isApproved;
    if (data.isApproved) {
      updateData.approvedAt = new Date();
      updateData.approvedById = admin.id;
    } else {
      updateData.approvedAt = null;
      updateData.approvedById = null;
    }
  }

  if (typeof data.isAdmin === "boolean") {
    updateData.isAdmin = data.isAdmin;
  }

  if (typeof data.maxUploads === "string" && data.maxUploads.trim()) {
    console.log("Max uploads data:", data.maxUploads);
    const maxUploads = parseInt(data.maxUploads);
    if (!isNaN(maxUploads) && maxUploads > 0) {
      updateData.maxUploads = maxUploads;
    }
  }

  if (typeof data.maxFileSize === "string" && data.maxFileSize.trim()) {
    console.log("Max file size data:", data.maxFileSize);
    const maxFileSize = parseInt(data.maxFileSize);
    if (!isNaN(maxFileSize) && maxFileSize > 0) {
      updateData.maxFileSize = maxFileSize;
    }
  }

  if (typeof data.maxStorageLimit === "string") {
    console.log("Max storage limit data:", data.maxStorageLimit);
    if (data.maxStorageLimit.trim() === "") {
      updateData.maxStorageLimit = null; // Use default
    } else {
      const maxStorageLimit = parseInt(data.maxStorageLimit);
      if (!isNaN(maxStorageLimit) && maxStorageLimit > 0) {
        updateData.maxStorageLimit = maxStorageLimit;
      }
    }
  }
  try {
    console.log("Updating user with data:", updateData);
    const result = await db.user.update({
      where: { id: data.userId as string },
      data: updateData,
    });
    console.log("Update result:", result);
    return { success: true };
  } catch (error) {
    console.error("Update error:", error);
    return { success: false, error: "Failed to update user" };
  }
});

export default component$(() => {
  const userData = useUserData();
  const updateUser = useUpdateUser();
  const searchQuery = useSignal("");
  const approvalFilter = useSignal("all"); // all, approved, pending
  const adminFilter = useSignal("all"); // all, admin, user
  const sortBy = useSignal("createdAt"); // createdAt, name, uploads, storageUsed, email
  const sortOrder = useSignal("desc"); // asc, desc

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getEffectiveStorageLimit = (user: any): number => {
    return (
      user.maxStorageLimit ||
      userData.value?.config.BASE_STORAGE_LIMIT ||
      10737418240
    );
  }; // Filter and sort users based on all criteria
  const filteredUsers = useComputed$(() => {
    let users = userData.value?.users || [];

    // Apply search filter
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim();
      users = users.filter((user: any) => {
        // Search by name (Discord display name/username)
        if (user.name?.toLowerCase().includes(query)) return true;

        // Search by email
        if (user.email?.toLowerCase().includes(query)) return true;

        // Search by Discord ID (providerAccountId)
        if (
          user.accounts?.some(
            (account: any) =>
              account.provider === "discord" &&
              account.providerAccountId?.includes(query),
          )
        )
          return true;

        // Search by user ID
        if (user.id?.toLowerCase().includes(query)) return true;

        return false;
      });
    }

    // Apply approval status filter
    if (approvalFilter.value !== "all") {
      users = users.filter((user: any) => {
        if (approvalFilter.value === "approved") return user.isApproved;
        if (approvalFilter.value === "pending") return !user.isApproved;
        return true;
      });
    }

    // Apply admin status filter
    if (adminFilter.value !== "all") {
      users = users.filter((user: any) => {
        if (adminFilter.value === "admin") return user.isAdmin;
        if (adminFilter.value === "user") return !user.isAdmin;
        return true;
      });
    }

    // Apply sorting
    users = [...users].sort((a: any, b: any) => {
      let aVal, bVal;

      switch (sortBy.value) {
        case "name":
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
          break;
        case "email":
          aVal = (a.email || "").toLowerCase();
          bVal = (b.email || "").toLowerCase();
          break;
        case "uploads":
          aVal = a._count?.uploads || 0;
          bVal = b._count?.uploads || 0;
          break;
        case "storageUsed":
          aVal = a.storageUsed || 0;
          bVal = b.storageUsed || 0;
          break;
        case "createdAt":
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
      }

      if (aVal < bVal) return sortOrder.value === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder.value === "asc" ? 1 : -1;
      return 0;
    });

    return users;
  });

  return (
    <>
      {/* Page Header */}
      <div class="mb-6 text-center sm:mb-8">
        <h1 class="text-gradient-cute mb-3 flex flex-wrap items-center justify-center gap-2 text-3xl font-bold sm:gap-3 sm:text-4xl">
          Admin Dashboard
        </h1>{" "}
        <p class="text-theme-secondary px-4 text-base sm:text-lg">
          Manage your twink community~ Approve users and keep everything safe!
          (◕‿◕)♡
        </p>
      </div>
      {/* Status Messages */}
      {updateUser.value?.success && (
        <div class="glass mb-6 rounded-3xl border border-green-400/30 bg-green-500/10 p-4 sm:mb-8 sm:p-6">
          <div class="flex items-center justify-center text-center">
            <CheckCircle class="mr-2 h-5 w-5 text-green-400" />
            <span class="font-medium text-green-300">
              User updated successfully! ✨
            </span>
          </div>
        </div>
      )}
      {updateUser.value?.error && (
        <div class="glass mb-6 rounded-3xl border border-red-400/30 bg-red-500/10 p-4 sm:mb-8 sm:p-6">
          <div class="flex items-center justify-center text-center">
            <Ban class="mr-2 h-5 w-5 text-red-400" />
            <span class="font-medium text-red-300">
              Error: {updateUser.value.error}
            </span>
          </div>
        </div>
      )}{" "}
      {/* Stats Cards */}
      <div class="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-6 md:grid-cols-4">
        <div class="card-cute rounded-3xl p-4 sm:p-6">
          <div class="flex items-center">
            <div class="rounded-full bg-gradient-to-br from-pink-500 to-purple-500 p-2 sm:p-3">
              <Users class="h-4 w-4 text-white sm:h-6 sm:w-6" />
            </div>{" "}
            <div class="ml-3 sm:ml-4">
              <p class="text-theme-secondary text-xs font-medium sm:text-sm">
                Total Users
              </p>
              <p class="text-theme-primary text-lg font-bold sm:text-2xl">
                {userData.value?.users.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div class="card-cute rounded-3xl p-4 sm:p-6">
          <div class="flex items-center">
            <div class="rounded-full bg-gradient-to-br from-green-500 to-emerald-500 p-2 sm:p-3">
              <CheckCircle class="h-4 w-4 text-white sm:h-6 sm:w-6" />
            </div>{" "}
            <div class="ml-3 sm:ml-4">
              <p class="text-theme-secondary text-xs font-medium sm:text-sm">
                Approved
              </p>
              <p class="text-theme-primary text-lg font-bold sm:text-2xl">
                {userData.value?.users.filter((u) => u.isApproved).length || 0}
              </p>
            </div>
          </div>
        </div>

        <div class="card-cute rounded-3xl p-4 sm:p-6">
          <div class="flex items-center">
            <div class="rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 p-2 sm:p-3">
              <Ban class="h-4 w-4 text-white sm:h-6 sm:w-6" />
            </div>{" "}
            <div class="ml-3 sm:ml-4">
              <p class="text-theme-secondary text-xs font-medium sm:text-sm">
                Pending
              </p>
              <p class="text-theme-primary text-lg font-bold sm:text-2xl">
                {userData.value?.users.filter((u) => !u.isApproved).length || 0}
              </p>
            </div>
          </div>
        </div>

        <div class="card-cute rounded-3xl p-4 sm:p-6">
          <div class="flex items-center">
            <div class="rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 p-2 sm:p-3">
              <Users class="h-4 w-4 text-white sm:h-6 sm:w-6" />
            </div>{" "}
            <div class="ml-3 sm:ml-4">
              <p class="text-theme-secondary text-xs font-medium sm:text-sm">
                New Users (7d)
              </p>
              <p class="text-theme-primary text-lg font-bold sm:text-2xl">
                {userData.value?.analyticsData?.reduce(
                  (sum, day) => sum + (day.usersRegistered || 0),
                  0,
                ) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Analytics Section */}
      <div class="mb-6 sm:mb-8">
        <h2 class="text-gradient-cute mb-4 flex items-center gap-2 text-xl font-bold sm:mb-6 sm:text-2xl">
          Analytics Overview - Last 7 Days
        </h2>{" "}
        <div class="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-4">
          <AnalyticsChart
            data={userData.value?.analyticsData || []}
            metric="totalViews"
            title="Total Views"
            color="var(--theme-primary)"
          />
          <AnalyticsChart
            data={userData.value?.analyticsData || []}
            metric="uniqueViews"
            title="Unique Visitors"
            color="var(--theme-accent)"
          />
          <AnalyticsChart
            data={userData.value?.analyticsData || []}
            metric="uploadsCount"
            title="New Uploads"
            color="var(--theme-accent-secondary)"
          />
          <AnalyticsChart
            data={userData.value?.analyticsData || []}
            metric="usersRegistered"
            title="New Users"
            color="var(--theme-success)"
          />
        </div>
      </div>
      {/* User Management */}
      <div class="card-cute mb-6 rounded-3xl p-4 sm:mb-8 sm:p-6">
        <div class="mb-4 flex flex-col gap-4">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="text-gradient-cute flex items-center gap-2 text-lg font-bold sm:text-xl">
              User Management{" "}
              {(searchQuery.value.trim() ||
                approvalFilter.value !== "all" ||
                adminFilter.value !== "all") && (
                <span class="text-theme-accent text-sm font-normal">
                  ({filteredUsers.value.length} of{" "}
                  {userData.value?.users.length || 0} users)
                </span>
              )}
            </h2>
            {/* Search Input */}
            <div class="relative w-full max-w-md sm:w-auto">
              {" "}
              <div class="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
                <Search class="text-theme-accent h-4 w-4 drop-shadow-sm" />
              </div>
              <input
                type="text"
                placeholder="Search by name, email, Discord ID..."
                value={searchQuery.value}
                onInput$={(e) => {
                  searchQuery.value = (e.target as HTMLInputElement).value;
                }}
                class="text-theme-primary bg-gradient-theme-card border-theme-card-border placeholder-theme-muted focus:border-theme-border focus:bg-gradient-theme-accent focus:ring-theme-accent/30 focus:shadow-theme-accent/20 hover:border-theme-border hover:shadow-theme-accent/10 w-full rounded-full border py-2 pr-4 pl-10 text-sm backdrop-blur-sm transition-all duration-500 hover:shadow-md focus:shadow-lg focus:ring-2 focus:outline-none"
              />
              <div class="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-pink-400/5 via-purple-400/5 to-cyan-400/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
            </div>
          </div>
          {/* Filters and Sorting */}
          <div class="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Approval Status Filter */}{" "}
            <div class="flex items-center gap-2">
              <Filter class="text-theme-accent h-4 w-4" />{" "}
              <select
                value={approvalFilter.value}
                onChange$={(e) => {
                  approvalFilter.value = (e.target as HTMLSelectElement).value;
                }}
                class="glass border-theme-card-border text-theme-primary focus:border-theme-border rounded-full border bg-transparent px-3 py-1 text-sm focus:outline-none"
              >
                <option value="all" class="bg-theme-card text-theme-primary">
                  All Users
                </option>
                <option
                  value="approved"
                  class="bg-theme-card text-theme-primary"
                >
                  ✅ Approved
                </option>
                <option
                  value="pending"
                  class="bg-theme-card text-theme-primary"
                >
                  ⏳ Pending
                </option>
              </select>
            </div>
            {/* Admin Status Filter */}
            <div class="flex items-center gap-2">
              {" "}
              <select
                value={adminFilter.value}
                onChange$={(e) => {
                  adminFilter.value = (e.target as HTMLSelectElement).value;
                }}
                class="glass border-theme-card-border text-theme-primary focus:border-theme-border rounded-full border bg-transparent px-3 py-1 text-sm focus:outline-none"
              >
                <option value="all" class="bg-theme-card text-theme-primary">
                  All Roles
                </option>
                <option value="admin" class="bg-theme-card text-theme-primary">
                  👑 Admins
                </option>
                <option value="user" class="bg-theme-card text-theme-primary">
                  🌸 Users
                </option>
              </select>
            </div>
            {/* Sort By */}
            <div class="flex items-center gap-2">
              <ArrowUpDown class="text-theme-accent h-4 w-4" />{" "}
              <select
                value={sortBy.value}
                onChange$={(e) => {
                  sortBy.value = (e.target as HTMLSelectElement).value;
                }}
                class="glass border-theme-card-border text-theme-primary focus:border-theme-border rounded-full border bg-transparent px-3 py-1 text-sm focus:outline-none"
              >
                <option
                  value="createdAt"
                  class="bg-theme-card text-theme-primary"
                >
                  Join Date
                </option>
                <option value="name" class="bg-theme-card text-theme-primary">
                  Name
                </option>
                <option value="email" class="bg-theme-card text-theme-primary">
                  Email
                </option>
                <option
                  value="uploads"
                  class="bg-theme-card text-theme-primary"
                >
                  Upload Count
                </option>
                <option
                  value="storageUsed"
                  class="bg-theme-card text-theme-primary"
                >
                  Storage Used
                </option>
              </select>
            </div>
            {/* Sort Order */}
            <button
              onClick$={() => {
                sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
              }}
              class="glass border-theme-card-border text-theme-primary hover:border-theme-border rounded-full border bg-transparent px-3 py-1 text-sm transition-all duration-300 focus:outline-none"
            >
              {sortOrder.value === "asc" ? "↑ Ascending" : "↓ Descending"}
            </button>{" "}
            {/* Clear Filters */}
            {(searchQuery.value.trim() ||
              approvalFilter.value !== "all" ||
              adminFilter.value !== "all" ||
              sortBy.value !== "createdAt" ||
              sortOrder.value !== "desc") && (
              <button
                onClick$={() => {
                  searchQuery.value = "";
                  approvalFilter.value = "all";
                  adminFilter.value = "all";
                  sortBy.value = "createdAt";
                  sortOrder.value = "desc";
                }}
                class="bg-gradient-theme-error border-theme-error text-theme-error hover:bg-gradient-theme-error-hover rounded-full border px-3 py-1 text-sm font-medium transition-all duration-300"
              >
                🗑️ Clear Filters
              </button>
            )}
          </div>
          {/* Quick Filter Buttons */}{" "}
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="text-theme-accent font-medium">Quick filters:</span>
            <button
              onClick$={() => {
                approvalFilter.value = "pending";
                adminFilter.value = "all";
                sortBy.value = "createdAt";
                sortOrder.value = "asc";
              }}
              class="glass border-theme-card-border text-theme-accent hover:border-theme-border rounded-full border px-2 py-1 text-xs transition-all duration-300"
            >
              ⏳ Pending Approval
            </button>{" "}
            <button
              onClick$={() => {
                approvalFilter.value = "all";
                adminFilter.value = "all";
                sortBy.value = "uploads";
                sortOrder.value = "desc";
              }}
              class="glass border-theme-card-border text-theme-accent hover:border-theme-border rounded-full border px-2 py-1 text-xs transition-all duration-300"
            >
              📈 Most Active
            </button>
            <button
              onClick$={() => {
                approvalFilter.value = "all";
                adminFilter.value = "all";
                sortBy.value = "storageUsed";
                sortOrder.value = "desc";
              }}
              class="glass border-theme-card-border text-theme-accent hover:border-theme-border rounded-full border px-2 py-1 text-xs transition-all duration-300"
            >
              💾 Storage Usage
            </button>
            <button
              onClick$={() => {
                approvalFilter.value = "all";
                adminFilter.value = "admin";
                sortBy.value = "createdAt";
                sortOrder.value = "desc";
              }}
              class="glass border-theme-card-border text-theme-accent hover:border-theme-border rounded-full border px-2 py-1 text-xs transition-all duration-300"
            >
              👑 Admins Only
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <div class="glass border-theme-card-border rounded-2xl border">
            {!userData.value?.users || userData.value.users.length === 0 ? (
              <div class="py-8 text-center sm:py-12">
                <div class="glass mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full sm:h-16 sm:w-16">
                  <div class="text-xl sm:text-2xl">👥</div>
                </div>
                <h3 class="text-theme-primary mb-2 text-base font-medium sm:text-lg">
                  No Users Yet! ✨
                </h3>
                <p class="text-theme-secondary px-4 text-sm sm:text-base">
                  Waiting for the first twinks to join~ (◕‿◕)♡
                </p>
              </div>
            ) : filteredUsers.value.length === 0 ? (
              <div class="py-8 text-center sm:py-12">
                <div class="glass mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full sm:h-16 sm:w-16">
                  <Search class="text-theme-accent h-6 w-6" />
                </div>
                <h3 class="text-theme-primary mb-2 text-base font-medium sm:text-lg">
                  No Results Found! 🔍
                </h3>
                <p class="text-theme-secondary px-4 text-sm sm:text-base">
                  Try adjusting your filters or search terms~ (◕‿◕)♡
                </p>
              </div>
            ) : (
              <div class="space-y-3 p-3 sm:space-y-4 sm:p-4">
                {filteredUsers.value.map((user: any) => (
                  <div
                    key={user.id}
                    class="glass border-theme-card-border hover:border-theme-border rounded-2xl p-3 transition-all duration-300 sm:p-4"
                  >
                    <div class="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* User Info */}
                      <div class="flex min-w-0 flex-1 items-center space-x-3">
                        {user.image && (
                          <img
                            class="border-theme-card-border h-10 w-10 rounded-full border-2"
                            src={user.image}
                            alt=""
                            width="40"
                            height="40"
                          />
                        )}{" "}
                        <div class="min-w-0 flex-1">
                          <div class="text-theme-primary truncate text-sm font-medium sm:text-base">
                            {user.name || "Anonymous Cutie"}
                          </div>
                          <div class="text-theme-secondary truncate text-xs sm:text-sm">
                            {user.email}
                          </div>
                          {user.accounts?.[0]?.providerAccountId && (
                            <div class="text-theme-accent truncate text-xs">
                              Discord ID: {user.accounts[0].providerAccountId}
                            </div>
                          )}
                          <div class="text-theme-accent mt-1 text-xs">
                            Joined{" "}
                            {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                          <div class="text-theme-accent mt-1 text-xs">
                            {user.id}
                          </div>
                        </div>
                      </div>

                      {/* Status & Activity */}
                      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        {" "}
                        {/* Status Badge */}
                        <div class="flex flex-col items-start sm:items-center">
                          <span
                            class={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              user.isApproved
                                ? "bg-gradient-theme-success border-theme-success text-theme-success"
                                : "bg-gradient-theme-warning border-theme-warning text-theme-warning"
                            }`}
                          >
                            {user.isApproved ? "✅ Approved" : "⏳ Pending"}
                          </span>{" "}
                          {user.approvedAt && (
                            <div class="text-theme-accent mt-1 text-xs">
                              by {user.approvedBy?.name || "Admin"}
                            </div>
                          )}
                        </div>{" "}
                        {/* Role Badge */}
                        <span
                          class={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            user.isAdmin
                              ? "bg-gradient-theme-accent-secondary border-theme-border text-theme-primary border"
                              : "bg-gradient-theme-muted border-theme-card-border text-theme-secondary border"
                          }`}
                        >
                          {user.isAdmin ? "👑 Admin" : "🌸 User"}
                        </span>
                        {/* Activity & Storage Stats */}
                        <div class="text-theme-secondary space-y-1 text-xs">
                          <div>📁 {user._count.uploads} uploads</div>
                          <div>🔑 {user._count.apiKeys} API keys</div>
                          <div>
                            💾 {formatBytes(user.storageUsed)} /{" "}
                            {formatBytes(getEffectiveStorageLimit(user))}
                          </div>
                          <div class="text-theme-accent text-xs">
                            {user.maxStorageLimit
                              ? "Custom limit"
                              : "Default limit"}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div class="flex flex-wrap gap-2">
                        {!user.isApproved && (
                          <button
                            onClick$={() => {
                              updateUser.submit({
                                userId: user.id,
                                isApproved: true,
                              });
                            }}
                            class="btn-cute rounded-full px-3 py-1 text-xs font-medium text-white sm:text-sm"
                          >
                            ✅ Approve
                          </button>
                        )}{" "}
                        {user.isApproved && (
                          <button
                            onClick$={() => {
                              updateUser.submit({
                                userId: user.id,
                                isApproved: false,
                              });
                            }}
                            class="bg-gradient-theme-error border-theme-error text-theme-error hover:bg-gradient-theme-error-hover rounded-full border px-3 py-1 text-xs font-medium transition-all duration-300 sm:text-sm"
                          >
                            ❌ Revoke
                          </button>
                        )}{" "}
                        <button
                          onClick$={() => {
                            updateUser.submit({
                              userId: user.id,
                              isAdmin: !user.isAdmin,
                            });
                          }}
                          class={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-300 sm:text-sm ${
                            user.isAdmin
                              ? "bg-gradient-theme-error border-theme-error text-theme-error hover:bg-gradient-theme-error-hover border"
                              : "bg-gradient-theme-accent-secondary border-theme-border text-theme-primary hover:bg-gradient-theme-accent border"
                          }`}
                        >
                          {user.isAdmin
                            ? "👑➡️👤 Remove Admin"
                            : "👤➡️👑 Make Admin"}
                        </button>
                      </div>
                    </div>
                    {/* Expandable Limits Editor */}
                    <details class="group mt-3">
                      {" "}
                      <summary class="text-theme-accent hover:text-theme-primary flex cursor-pointer items-center gap-1 text-xs font-medium">
                        <span class="transition-transform group-open:rotate-90">
                          ▶
                        </span>
                        Edit User Limits
                      </summary>
                      <div class="glass border-theme-card-border mt-3 rounded-xl border p-3">
                        <form
                          class="grid grid-cols-1 gap-3 md:grid-cols-3"
                          preventdefault:submit
                          onSubmit$={(e, currentTarget) => {
                            const formData = new FormData(currentTarget);
                            updateUser.submit({
                              userId: user.id,
                              maxUploads: formData.get("maxUploads") as string,
                              maxFileSize: formData.get(
                                "maxFileSize",
                              ) as string,
                              maxStorageLimit: formData.get(
                                "maxStorageLimit",
                              ) as string,
                            });
                          }}
                        >
                          {" "}
                          <div>
                            <label class="text-theme-secondary mb-1 block text-xs font-medium">
                              Max Uploads
                            </label>
                            <input
                              type="number"
                              name="maxUploads"
                              value={user.maxUploads}
                              class="glass border-theme-card-border text-theme-primary focus:border-theme-border w-full rounded border bg-transparent px-2 py-1 text-xs focus:outline-none"
                              min="1"
                            />
                          </div>
                          <div>
                            <label class="text-theme-secondary mb-1 block text-xs font-medium">
                              Max File Size (bytes)
                            </label>
                            <input
                              type="number"
                              name="maxFileSize"
                              value={user.maxFileSize}
                              class="glass border-theme-card-border text-theme-primary focus:border-theme-border w-full rounded border bg-transparent px-2 py-1 text-xs focus:outline-none"
                              min="1"
                            />
                            <div class="text-theme-accent mt-1 text-xs">
                              Current: {formatBytes(user.maxFileSize)}
                            </div>
                          </div>
                          <div>
                            <label class="text-theme-secondary mb-1 block text-xs font-medium">
                              Storage Limit (bytes)
                            </label>
                            <input
                              type="number"
                              name="maxStorageLimit"
                              value={user.maxStorageLimit || ""}
                              placeholder={`Default: ${formatBytes(userData.value?.config.BASE_STORAGE_LIMIT || 10737418240)}`}
                              class="glass border-theme-card-border text-theme-primary focus:border-theme-border w-full rounded border bg-transparent px-2 py-1 text-xs focus:outline-none"
                              min="1"
                            />
                            <div class="text-theme-accent mt-1 text-xs">
                              {user.maxStorageLimit
                                ? `Custom: ${formatBytes(user.maxStorageLimit)}`
                                : `Using default: ${formatBytes(userData.value?.config.BASE_STORAGE_LIMIT || 10737418240)}`}
                            </div>
                          </div>
                          <div class="flex gap-2 pt-2 md:col-span-3">
                            <button
                              type="submit"
                              class="btn-cute rounded-full px-3 py-1 text-xs font-medium text-white"
                            >
                              💾 Save Limits
                            </button>{" "}
                            <button
                              type="button"
                              onClick$={() => {
                                updateUser.submit({
                                  userId: user.id,
                                  maxStorageLimit: "",
                                });
                              }}
                              class="bg-gradient-theme-muted border-theme-card-border text-theme-secondary hover:bg-gradient-theme-accent rounded-full border px-3 py-1 text-xs font-medium transition-all duration-300"
                            >
                              🔄 Reset to Default
                            </button>
                          </div>{" "}
                        </form>
                      </div>
                    </details>{" "}
                    {/* User Analytics */}
                    <UserAnalytics
                      userId={user.id}
                      userName={user.name || "Anonymous Cutie"}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});
