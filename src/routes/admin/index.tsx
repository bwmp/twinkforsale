import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$ } from "@builder.io/qwik-city";
import { db } from "~/lib/db";
import { getEnvConfig } from "~/lib/env";
import { getAnalyticsData } from "~/lib/analytics";
import { Users, CheckCircle, Ban, Search, Filter, ArrowUpDown, TrendingUp } from "lucide-icons-qwik";
import { AnalyticsChart } from "~/components/analytics-chart/analytics-chart";
import { UserAnalytics } from "~/components/user-analytics/user-analytics";

export const useUserData = routeLoader$(async ({ sharedMap, redirect }) => {
  const session = sharedMap.get("session");

  if (!session?.user?.email) {
    throw redirect(302, "/");
  }

  // Find user and verify admin status
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, isAdmin: true }
  });

  if (!user?.isAdmin) {
    throw redirect(302, "/dashboard");
  }  // Get all users with their approval status and Discord account info
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
          email: true
        }
      },
      accounts: {
        select: {
          provider: true,
          providerAccountId: true
        },
        where: {
          provider: "discord"
        }
      },
      _count: {
        select: {
          uploads: true,
          apiKeys: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const config = getEnvConfig();

  // Get analytics data for the last week
  const analyticsData = await getAnalyticsData(7);

  return { users, currentUser: user, config, analyticsData };
});

export const useUpdateUser = routeAction$(async (data, { sharedMap }) => {
  const session = sharedMap.get("session");

  if (!session?.user?.email) {
    return { success: false, error: "Authentication required" };
  }

  // Verify admin status
  const admin = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, isAdmin: true }
  });

  if (!admin?.isAdmin) {
    return { success: false, error: "Admin access required" };
  }

  if (!data.userId) {
    return { success: false, error: "userId is required" };
  }
  // Update user
  const updateData: any = {};

  if (typeof data.isApproved === 'boolean') {
    updateData.isApproved = data.isApproved;
    if (data.isApproved) {
      updateData.approvedAt = new Date();
      updateData.approvedById = admin.id;
    } else {
      updateData.approvedAt = null;
      updateData.approvedById = null;
    }
  }

  if (typeof data.isAdmin === 'boolean') {
    updateData.isAdmin = data.isAdmin;
  }

  if (typeof data.maxUploads === 'string' && data.maxUploads.trim()) {
    console.log("Max uploads data:", data.maxUploads);
    const maxUploads = parseInt(data.maxUploads);
    if (!isNaN(maxUploads) && maxUploads > 0) {
      updateData.maxUploads = maxUploads;
    }
  }

  if (typeof data.maxFileSize === 'string' && data.maxFileSize.trim()) {
    console.log("Max file size data:", data.maxFileSize);
    const maxFileSize = parseInt(data.maxFileSize);
    if (!isNaN(maxFileSize) && maxFileSize > 0) {
      updateData.maxFileSize = maxFileSize;
    }
  }

  if (typeof data.maxStorageLimit === 'string') {
    console.log("Max storage limit data:", data.maxStorageLimit);
    if (data.maxStorageLimit.trim() === '') {
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
      data: updateData
    });
    console.log("Update result:", result); return { success: true };
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
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getEffectiveStorageLimit = (user: any): number => {
    return user.maxStorageLimit || userData.value?.config.BASE_STORAGE_LIMIT || 10737418240;
  };  // Filter and sort users based on all criteria
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
        if (user.accounts?.some((account: any) =>
          account.provider === "discord" && account.providerAccountId?.includes(query)
        )) return true;

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
      <div class="mb-6 sm:mb-8 text-center">
        <h1 class="text-3xl sm:text-4xl font-bold text-gradient-cute mb-3 flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          Admin Dashboard
        </h1>
        <p class="text-pink-200 text-base sm:text-lg px-4">
          Manage your kawaii community~ Approve users and keep everything safe! (◕‿◕)♡
        </p>
      </div>

      {/* Status Messages */}
      {updateUser.value?.success && (
        <div class="mb-6 sm:mb-8 p-4 sm:p-6 glass rounded-3xl border border-green-400/30 bg-green-500/10">
          <div class="flex items-center justify-center text-center">
            <CheckCircle class="w-5 h-5 text-green-400 mr-2" />
            <span class="text-green-300 font-medium">User updated successfully! ✨</span>
          </div>
        </div>
      )}

      {updateUser.value?.error && (
        <div class="mb-6 sm:mb-8 p-4 sm:p-6 glass rounded-3xl border border-red-400/30 bg-red-500/10">
          <div class="flex items-center justify-center text-center">
            <Ban class="w-5 h-5 text-red-400 mr-2" />
            <span class="text-red-300 font-medium">Error: {updateUser.value.error}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div class="card-cute p-4 sm:p-6 rounded-3xl">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full">
              <Users class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200">Total Users</p>
              <p class="text-lg sm:text-2xl font-bold text-white">{userData.value?.users.length || 0}</p>
            </div>
          </div>
        </div>

        <div class="card-cute p-4 sm:p-6 rounded-3xl">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full">
              <CheckCircle class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200">Approved</p>
              <p class="text-lg sm:text-2xl font-bold text-white">
                {userData.value?.users.filter(u => u.isApproved).length || 0}
              </p>
            </div>
          </div>
        </div>

        <div class="card-cute p-4 sm:p-6 rounded-3xl">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full">
              <Ban class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200">Pending</p>
              <p class="text-lg sm:text-2xl font-bold text-white">
                {userData.value?.users.filter(u => !u.isApproved).length || 0}
              </p>
            </div>
          </div>        </div>
      </div>

      {/* Analytics Section */}
      <div class="mb-6 sm:mb-8">
        <h2 class="text-xl sm:text-2xl font-bold text-gradient-cute mb-4 sm:mb-6 flex items-center gap-2">
          <TrendingUp class="w-5 h-5" />
          Analytics Overview - Last 7 Days
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <AnalyticsChart
            data={userData.value?.analyticsData || []}
            metric="totalViews"
            title="Total Views"
            color="#ec4899"
          />
          <AnalyticsChart
            data={userData.value?.analyticsData || []}
            metric="uniqueViews"
            title="Unique Visitors"
            color="#8b5cf6"
          />
          <AnalyticsChart
            data={userData.value?.analyticsData || []}
            metric="uploadsCount"
            title="New Uploads"
            color="#06b6d4"
          />
        </div>
      </div>

      {/* User Management */}
      <div class="card-cute rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8">
        <div class="flex flex-col gap-4 mb-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 class="text-lg sm:text-xl font-bold text-gradient-cute flex items-center gap-2">
              User Management
              {(searchQuery.value.trim() || approvalFilter.value !== "all" || adminFilter.value !== "all") && (
                <span class="text-sm font-normal text-pink-300">
                  ({filteredUsers.value.length} of {userData.value?.users.length || 0} users)
                </span>
              )}
            </h2>
            {/* Search Input */}
            <div class="relative max-w-md w-full sm:w-auto">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                <Search class="h-4 w-4 text-pink-300 drop-shadow-sm" />
              </div>
              <input
                type="text"
                placeholder="Search by name, email, Discord ID..."
                value={searchQuery.value}
                onInput$={(e) => {
                  searchQuery.value = (e.target as HTMLInputElement).value;
                }}
                class="w-full pl-10 pr-4 py-2 text-sm rounded-full border text-white bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 backdrop-blur-sm border-pink-300/30 placeholder-pink-300/70 focus:border-pink-400/60 focus:bg-gradient-to-r focus:from-pink-500/20 focus:via-purple-500/20 focus:to-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-pink-400/30 focus:shadow-lg focus:shadow-pink-400/20 transition-all duration-500 hover:border-pink-400/50 hover:shadow-md hover:shadow-pink-400/10"
              />
              <div class="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400/5 via-purple-400/5 to-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </div>
          </div>

          {/* Filters and Sorting */}
          <div class="flex flex-wrap gap-3 sm:gap-4 items-center">
            {/* Approval Status Filter */}
            <div class="flex items-center gap-2">
              <Filter class="h-4 w-4 text-pink-300" />
              <select
                value={approvalFilter.value}
                onChange$={(e) => {
                  approvalFilter.value = (e.target as HTMLSelectElement).value;
                }}
                class="px-3 py-1 text-sm glass rounded-full border border-pink-300/30 text-white bg-transparent focus:border-pink-300/60 focus:outline-none"
              >
                <option value="all" class="bg-gray-800">All Users</option>
                <option value="approved" class="bg-gray-800">✅ Approved</option>
                <option value="pending" class="bg-gray-800">⏳ Pending</option>
              </select>
            </div>

            {/* Admin Status Filter */}
            <div class="flex items-center gap-2">
              <select
                value={adminFilter.value}
                onChange$={(e) => {
                  adminFilter.value = (e.target as HTMLSelectElement).value;
                }}
                class="px-3 py-1 text-sm glass rounded-full border border-pink-300/30 text-white bg-transparent focus:border-pink-300/60 focus:outline-none"
              >
                <option value="all" class="bg-gray-800">All Roles</option>
                <option value="admin" class="bg-gray-800">👑 Admins</option>
                <option value="user" class="bg-gray-800">🌸 Users</option>
              </select>
            </div>

            {/* Sort By */}
            <div class="flex items-center gap-2">
              <ArrowUpDown class="h-4 w-4 text-pink-300" />
              <select
                value={sortBy.value}
                onChange$={(e) => {
                  sortBy.value = (e.target as HTMLSelectElement).value;
                }}
                class="px-3 py-1 text-sm glass rounded-full border border-pink-300/30 text-white bg-transparent focus:border-pink-300/60 focus:outline-none"
              >
                <option value="createdAt" class="bg-gray-800">Join Date</option>
                <option value="name" class="bg-gray-800">Name</option>
                <option value="email" class="bg-gray-800">Email</option>
                <option value="uploads" class="bg-gray-800">Upload Count</option>
                <option value="storageUsed" class="bg-gray-800">Storage Used</option>
              </select>
            </div>

            {/* Sort Order */}
            <button
              onClick$={() => {
                sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
              }}
              class="px-3 py-1 text-sm glass rounded-full border border-pink-300/30 text-white bg-transparent hover:border-pink-300/60 focus:outline-none transition-all duration-300"
            >
              {sortOrder.value === "asc" ? "↑ Ascending" : "↓ Descending"}
            </button>            {/* Clear Filters */}
            {(searchQuery.value.trim() || approvalFilter.value !== "all" || adminFilter.value !== "all" || sortBy.value !== "createdAt" || sortOrder.value !== "desc") && (
              <button
                onClick$={() => {
                  searchQuery.value = "";
                  approvalFilter.value = "all";
                  adminFilter.value = "all";
                  sortBy.value = "createdAt";
                  sortOrder.value = "desc";
                }}
                class="px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-full font-medium transition-all duration-300"
              >
                🗑️ Clear Filters
              </button>
            )}
          </div>

          {/* Quick Filter Buttons */}
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="text-pink-300 font-medium">Quick filters:</span>
            <button
              onClick$={() => {
                approvalFilter.value = "pending";
                adminFilter.value = "all";
                sortBy.value = "createdAt";
                sortOrder.value = "asc";
              }}
              class="px-2 py-1 text-xs glass rounded-full border border-yellow-400/30 text-yellow-300 hover:border-yellow-400/60 transition-all duration-300"
            >
              ⏳ Pending Approval
            </button>
            <button
              onClick$={() => {
                approvalFilter.value = "all";
                adminFilter.value = "all";
                sortBy.value = "uploads";
                sortOrder.value = "desc";
              }}
              class="px-2 py-1 text-xs glass rounded-full border border-blue-400/30 text-blue-300 hover:border-blue-400/60 transition-all duration-300"
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
              class="px-2 py-1 text-xs glass rounded-full border border-purple-400/30 text-purple-300 hover:border-purple-400/60 transition-all duration-300"
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
              class="px-2 py-1 text-xs glass rounded-full border border-pink-400/30 text-pink-300 hover:border-pink-400/60 transition-all duration-300"
            >
              👑 Admins Only
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <div class="glass rounded-2xl border border-pink-300/20">
            {(!userData.value?.users || userData.value.users.length === 0) ? (
              <div class="text-center py-8 sm:py-12">
                <div class="w-12 sm:w-16 h-12 sm:h-16 glass rounded-full flex items-center justify-center mx-auto mb-4">
                  <div class="text-xl sm:text-2xl">👥</div>
                </div>
                <h3 class="text-base sm:text-lg font-medium text-white mb-2">No Users Yet! ✨</h3>
                <p class="text-pink-200 text-sm sm:text-base px-4">
                  Waiting for the first kawaii users to join~ (◕‿◕)♡
                </p>
              </div>
            ) : filteredUsers.value.length === 0 ? (
              <div class="text-center py-8 sm:py-12">
                <div class="w-12 sm:w-16 h-12 sm:h-16 glass rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search class="h-6 w-6 text-pink-300" />
                </div>                <h3 class="text-base sm:text-lg font-medium text-white mb-2">No Results Found! 🔍</h3>
                <p class="text-pink-200 text-sm sm:text-base px-4">
                  Try adjusting your filters or search terms~ (◕‿◕)♡
                </p>
              </div>
            ) : (
              <div class="space-y-3 sm:space-y-4 p-3 sm:p-4">
                {filteredUsers.value.map((user: any) => (
                  <div key={user.id} class="glass rounded-2xl p-3 sm:p-4 !border-pink-300/20 !hover:border-pink-300/40 transition-all duration-300">
                    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
                      {/* User Info */}
                      <div class="flex items-center space-x-3 min-w-0 flex-1">
                        {user.image && (
                          <img
                            class="h-10 w-10 rounded-full border-2 border-pink-300/30"
                            src={user.image}
                            alt=""
                            width="40"
                            height="40"
                          />
                        )}
                        <div class="min-w-0 flex-1">
                          <div class="text-sm sm:text-base font-medium text-white truncate">
                            {user.name || "Anonymous Cutie"}
                          </div>
                          <div class="text-xs sm:text-sm text-pink-200 truncate">{user.email}</div>
                          {user.accounts?.[0]?.providerAccountId && (
                            <div class="text-xs text-purple-300 truncate">
                              Discord ID: {user.accounts[0].providerAccountId}
                            </div>
                          )}
                          <div class="text-xs text-pink-300 mt-1">
                            Joined {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                          <div class="text-xs text-pink-300 mt-1">
                            {user.id}
                          </div>
                        </div>
                      </div>

                      {/* Status & Activity */}
                      <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        {/* Status Badge */}
                        <div class="flex flex-col items-start sm:items-center">
                          <span class={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.isApproved
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                            }`}>
                            {user.isApproved ? '✅ Approved' : '⏳ Pending'}
                          </span>
                          {user.approvedAt && (
                            <div class="text-xs text-pink-300 mt-1">
                              by {user.approvedBy?.name || 'Admin'}
                            </div>
                          )}
                        </div>

                        {/* Role Badge */}
                        <span class={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.isAdmin
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                          }`}>
                          {user.isAdmin ? '👑 Admin' : '🌸 User'}
                        </span>
                        {/* Activity & Storage Stats */}
                        <div class="text-xs text-pink-200 space-y-1">
                          <div>📁 {user._count.uploads} uploads</div>
                          <div>🔑 {user._count.apiKeys} API keys</div>
                          <div>💾 {formatBytes(user.storageUsed)} / {formatBytes(getEffectiveStorageLimit(user))}</div>
                          <div class="text-xs text-pink-300">
                            {user.maxStorageLimit ? 'Custom limit' : 'Default limit'}
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
                                isApproved: true
                              });
                            }}
                            class="btn-cute px-3 py-1 text-xs sm:text-sm text-white rounded-full font-medium"
                          >
                            ✅ Approve
                          </button>
                        )}

                        {user.isApproved && (
                          <button
                            onClick$={() => {
                              updateUser.submit({
                                userId: user.id,
                                isApproved: false
                              });
                            }}
                            class="px-3 py-1 text-xs sm:text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-full font-medium transition-all duration-300"
                          >
                            ❌ Revoke
                          </button>
                        )}
                        <button
                          onClick$={() => {
                            updateUser.submit({
                              userId: user.id,
                              isAdmin: !user.isAdmin
                            });
                          }}
                          class={`px-3 py-1 text-xs sm:text-sm rounded-full font-medium transition-all duration-300 ${user.isAdmin
                            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                            : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30'
                            }`}
                        >
                          {user.isAdmin ? '👑➡️👤 Remove Admin' : '👤➡️👑 Make Admin'}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Limits Editor */}
                    <details class="mt-3 group">
                      <summary class="cursor-pointer text-xs text-pink-300 hover:text-pink-200 font-medium flex items-center gap-1">
                        <span class="group-open:rotate-90 transition-transform">▶</span>
                        Edit User Limits
                      </summary>

                      <div class="mt-3 p-3 glass rounded-xl border border-pink-300/20">
                        <form
                          class="grid grid-cols-1 md:grid-cols-3 gap-3"
                          preventdefault:submit
                          onSubmit$={(e, currentTarget) => {
                            const formData = new FormData(currentTarget);
                            updateUser.submit({
                              userId: user.id,
                              maxUploads: formData.get('maxUploads') as string,
                              maxFileSize: formData.get('maxFileSize') as string,
                              maxStorageLimit: formData.get('maxStorageLimit') as string,
                            });
                          }}
                        >
                          <div>
                            <label class="block text-xs font-medium text-pink-200 mb-1">
                              Max Uploads
                            </label>
                            <input
                              type="number"
                              name="maxUploads"
                              value={user.maxUploads}
                              class="w-full px-2 py-1 text-xs glass rounded border border-pink-300/20 text-white bg-transparent focus:border-pink-300/40 focus:outline-none"
                              min="1"
                            />
                          </div>

                          <div>
                            <label class="block text-xs font-medium text-pink-200 mb-1">
                              Max File Size (bytes)
                            </label>
                            <input
                              type="number"
                              name="maxFileSize"
                              value={user.maxFileSize}
                              class="w-full px-2 py-1 text-xs glass rounded border border-pink-300/20 text-white bg-transparent focus:border-pink-300/40 focus:outline-none"
                              min="1"
                            />
                            <div class="text-xs text-pink-300 mt-1">
                              Current: {formatBytes(user.maxFileSize)}
                            </div>
                          </div>

                          <div>
                            <label class="block text-xs font-medium text-pink-200 mb-1">
                              Storage Limit (bytes)
                            </label>
                            <input
                              type="number"
                              name="maxStorageLimit"
                              value={user.maxStorageLimit || ''}
                              placeholder={`Default: ${formatBytes(userData.value?.config.BASE_STORAGE_LIMIT || 10737418240)}`}
                              class="w-full px-2 py-1 text-xs glass rounded border border-pink-300/20 text-white bg-transparent focus:border-pink-300/40 focus:outline-none"
                              min="1"
                            />
                            <div class="text-xs text-pink-300 mt-1">
                              {user.maxStorageLimit
                                ? `Custom: ${formatBytes(user.maxStorageLimit)}`
                                : `Using default: ${formatBytes(userData.value?.config.BASE_STORAGE_LIMIT || 10737418240)}`
                              }
                            </div>
                          </div>

                          <div class="md:col-span-3 flex gap-2 pt-2">
                            <button
                              type="submit"
                              class="btn-cute px-3 py-1 text-xs text-white rounded-full font-medium"
                            >
                              💾 Save Limits
                            </button>
                            <button
                              type="button"
                              onClick$={() => {
                                updateUser.submit({
                                  userId: user.id,
                                  maxStorageLimit: '',
                                });
                              }}
                              class="px-3 py-1 text-xs bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 border border-gray-500/30 rounded-full font-medium transition-all duration-300"
                            >
                              🔄 Reset to Default
                            </button>
                          </div>                        </form>
                      </div>
                    </details>                    {/* User Analytics */}
                    <UserAnalytics userId={user.id} userName={user.name || "Anonymous Cutie"} />
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
