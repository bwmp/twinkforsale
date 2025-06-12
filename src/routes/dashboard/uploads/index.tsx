import {
  component$,
  $,
  useContext,
  useSignal,
  useComputed$,
} from "@builder.io/qwik";
import { routeLoader$, routeAction$, Link } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { setUploadsViewMode } from "~/lib/cookie-utils";
import fs from "fs";
import path from "path";
import {
  Folder,
  Eye,
  HardDrive,
  Clock,
  Copy,
  Trash2,
  Sparkle,
  FileText,
  Ruler,
  Calendar,
  Zap,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Grid,
  List,
  TrendingUp,
  CheckSquare,
  Square,
} from "lucide-icons-qwik";
import { ImagePreviewContext } from "~/lib/image-preview-store";

export const useDeleteUpload = routeAction$(async (data, requestEvent) => {
  // Import server-side dependencies inside the action
  const { db } = await import("~/lib/db");
  const { getEnvConfig } = await import("~/lib/env");

  const session = requestEvent.sharedMap.get("session");

  if (!session?.user?.email) {
    return { success: false, error: "Not authenticated" };
  }

  const deletionKeys = data.deletionKeys as string[] | string;
  const keysArray = Array.isArray(deletionKeys) ? deletionKeys : [deletionKeys];

  if (!keysArray.length) {
    return { success: false, error: "No deletion keys provided" };
  }
  try {
    const results = [];
    let totalStorageDecrement = 0;
    const config = getEnvConfig();
    const baseUploadDir = config.UPLOAD_DIR;

    // Process each deletion key
    for (const deletionKey of keysArray) {
      // Find upload by deletion key and verify ownership
      const upload = await db.upload.findUnique({
        where: { deletionKey },
        include: { user: true },
      });

      if (!upload) {
        results.push({
          key: deletionKey,
          success: false,
          error: "File not found",
        });
        continue;
      }

      // Verify user owns this upload
      if (upload.user?.email !== session.user.email) {
        results.push({
          key: deletionKey,
          success: false,
          error: "Unauthorized",
        });
        continue;
      }

      // Delete file from storage
      let filePath: string;
      if (upload.userId) {
        filePath = path.join(baseUploadDir, upload.userId, upload.filename);
      } else {
        filePath = path.join(baseUploadDir, "anonymous", upload.filename);
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from database
      await db.upload.delete({
        where: { id: upload.id },
      });

      totalStorageDecrement += upload.size;
      results.push({ key: deletionKey, success: true });
    }

    // Update user storage in a single transaction
    if (totalStorageDecrement > 0) {
      await db.user.update({
        where: { email: session.user.email },
        data: {
          storageUsed: {
            decrement: totalStorageDecrement,
          },
        },
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    return {
      success: true,
      results,
      successCount,
      failureCount,
      message: `Successfully deleted ${successCount} file${successCount !== 1 ? "s" : ""}${failureCount > 0 ? `, ${failureCount} failed` : ""}`,
    };
  } catch (error) {
    console.error("Deletion error:", error);
    return { success: false, error: "Failed to delete files" };
  }
});

export const useUserUploads = routeLoader$(async (requestEvent) => {
  // Import server-side dependencies inside the loader
  const { db } = await import("~/lib/db");
  const { getEnvConfig } = await import("~/lib/env");
  const { getUploadAnalytics } = await import("~/lib/analytics");

  const session = requestEvent.sharedMap.get("session");

  if (!session?.user?.email) {
    throw requestEvent.redirect(302, "/");
  }

  // Get environment configuration for storage limits
  const config = getEnvConfig();

  // Find user and their uploads
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: {
      uploads: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    throw requestEvent.redirect(302, "/");
  }

  // Calculate the effective storage limit (user's custom limit or default from env)
  const effectiveStorageLimit =
    user.maxStorageLimit || config.BASE_STORAGE_LIMIT;

  // Get analytics data for each upload (last 7 days)
  const uploadsWithAnalytics = await Promise.all(
    user.uploads.map(async (upload) => {
      const analytics = await getUploadAnalytics(upload.id, 7);
      const totalViews = analytics.reduce(
        (sum, day) => sum + day.totalViews,
        0,
      );
      const uniqueViews = analytics.reduce(
        (sum, day) => sum + day.uniqueViews,
        0,
      );

      return {
        ...upload,
        analytics,
        weeklyViews: totalViews,
        weeklyUniqueViews: uniqueViews,
      };
    }),
  ); // Get view mode preference from cookies server-side
  const { getServerUploadsViewMode } = await import("~/lib/cookie-utils");
  const cookieHeader = requestEvent.request.headers.get("cookie");
  const savedViewMode =
    getServerUploadsViewMode(cookieHeader || undefined) || "list";

  return {
    user: {
      ...user,
      uploads: uploadsWithAnalytics,
    },
    effectiveStorageLimit,
    origin: requestEvent.url.origin,
    savedViewMode,
  };
});

export default component$(() => {
  const userData = useUserUploads();
  const deleteUploadAction = useDeleteUpload();
  const imagePreview = useContext(ImagePreviewContext);

  const searchQuery = useSignal("");
  const sortBy = useSignal<"name" | "size" | "views" | "date">("date");
  const sortOrder = useSignal<"asc" | "desc">("desc");
  // Initialize viewMode from server-side data
  const viewMode = useSignal<"grid" | "list">(
    userData.value.savedViewMode as "grid" | "list",
  );
  // Bulk selection state
  const selectedFiles = useSignal<Set<string>>(new Set());

  const copyToClipboard = $((text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  });
  const deleteUpload = $(async (deletionKey: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    const result = await deleteUploadAction.submit({
      deletionKeys: deletionKey,
    });

    if (result.value.success) {
      // Reload the page to refresh the upload list
      window.location.reload();
    } else {
      alert(result.value.error || "Failed to delete file");
    }
  });

  // Filter and sort uploads
  const filteredAndSortedUploads = useComputed$(() => {
    let uploads = userData.value.user.uploads || [];

    // Filter by search query
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim();
      uploads = uploads.filter(
        (upload: any) =>
          upload.originalName.toLowerCase().includes(query) ||
          upload.mimeType.toLowerCase().includes(query),
      );
    }

    // Sort uploads
    uploads = [...uploads].sort((a: any, b: any) => {
      let comparison = 0;

      switch (sortBy.value) {
        case "name":
          comparison = a.originalName.localeCompare(b.originalName);
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "views":
          comparison = a.views - b.views;
          break;
        case "date":
        default:
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sortOrder.value === "asc" ? comparison : -comparison;
    });

    return uploads;
  });

  // Bulk action functions
  const toggleFileSelection = $((deletionKey: string) => {
    const newSelection = new Set(selectedFiles.value);
    if (newSelection.has(deletionKey)) {
      newSelection.delete(deletionKey);
    } else {
      newSelection.add(deletionKey);
    }
    selectedFiles.value = newSelection;
  });

  const selectAllVisibleFiles = $(() => {
    const allKeys = filteredAndSortedUploads.value.map(
      (upload) => upload.deletionKey,
    );
    selectedFiles.value = new Set(allKeys);
  });

  const deselectAllFiles = $(() => {
    selectedFiles.value = new Set();
  });
  const bulkDelete = $(async () => {
    const selectedCount = selectedFiles.value.size;
    if (selectedCount === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedCount} selected file${selectedCount !== 1 ? "s" : ""}?`,
      )
    ) {
      return;
    }

    const result = await deleteUploadAction.submit({
      deletionKeys: Array.from(selectedFiles.value),
    });

    if (result.value.success) {
      selectedFiles.value = new Set();
      // Reload the page to refresh the upload list
      window.location.reload();
    } else {
      alert(result.value.error || "Failed to delete files");
    }
  });
  const bulkCopyUrls = $(() => {
    const selectedUploads = filteredAndSortedUploads.value.filter((upload) =>
      selectedFiles.value.has(upload.deletionKey),
    );

    const urls = selectedUploads
      .map((upload) => `${userData.value.origin}/f/${upload.shortCode}`)
      .join("\n");

    navigator.clipboard.writeText(urls);
    // Could show a toast notification here
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";

    // Handle negative numbers (over quota)
    const isNegative = bytes < 0;
    const absoluteBytes = Math.abs(bytes);

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(absoluteBytes) / Math.log(k));
    const formattedSize =
      parseFloat((absoluteBytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];

    return isNegative ? `-${formattedSize}` : formattedSize;
  };

  const handleSort = $((column: "name" | "size" | "views" | "date") => {
    if (sortBy.value === column) {
      // Toggle sort order if clicking the same column
      sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
    } else {
      // Set new column and default to descending
      sortBy.value = column;
      sortOrder.value = "desc";
    }
  });
  const getSortIcon = (column: "name" | "size" | "views" | "date") => {
    if (sortBy.value !== column) {
      return (
        <ArrowUpDown class="text-theme-muted ml-1 inline h-3 w-3 opacity-50" />
      );
    }
    return sortOrder.value === "asc" ? (
      <ArrowUp class="text-theme-muted ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown class="text-theme-muted ml-1 inline h-3 w-3" />
    );
  }; // Mini analytics chart component for grid view
  const MiniChart = component$(({ data }: { data: any[] }) => {
    if (!data || data.length === 0)
      return <div class="text-theme-muted text-xs">No data</div>;

    const maxViews = Math.max(...data.map((d) => d.totalViews), 1);
    const points = data
      .map((d, i) => {
        const x = (i / (data.length - 1)) * 60;
        const y = 20 - (d.totalViews / maxViews) * 20;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg class="h-6 w-16" viewBox="0 0 60 20">
        <polyline
          fill="none"
          stroke-width="1.5"
          points={points}
          class="stroke-theme-accent-primary"
        />
      </svg>
    );
  });

  return (
    <div>
      {/* Page Header */}
      <div class="mb-6 text-center sm:mb-8">
        <h1 class="text-gradient-cute mb-3 flex flex-wrap items-center justify-center gap-2 text-3xl font-bold sm:text-4xl">
          My Uploads~
        </h1>
        <p class="text-theme-secondary px-4 text-base sm:text-lg">
          Manage all your cute uploads and view their sparkly statistics! (◕‿◕)♡
        </p>
      </div>

      {/* Stats Summary */}
      <div class="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-6 md:grid-cols-4">
        {" "}
        <div class="card-cute pulse-soft rounded-3xl p-4 sm:p-6">
          <div class="flex items-center">
            {" "}
            <div class="bg-gradient-theme-primary-secondary rounded-full p-2 sm:p-3">
              <Folder class="text-theme-primary h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-theme-secondary flex items-center gap-1 text-xs font-medium sm:text-sm">
                {searchQuery.value.trim() ? "Filtered Files~" : "Total Files~"}
                <Sparkle class="h-3 w-3 sm:h-4 sm:w-4" />
              </p>
              <p class="text-theme-primary text-lg font-bold sm:text-2xl">
                {searchQuery.value.trim()
                  ? filteredAndSortedUploads.value.length
                  : userData.value.user.uploads.length}
              </p>
            </div>
          </div>
        </div>
        <div class="card-cute pulse-soft rounded-3xl p-4 sm:p-6">
          <div class="flex items-center">
            {" "}
            <div class="bg-gradient-theme-secondary-tertiary rounded-full p-2 sm:p-3">
              <Eye class="text-theme-primary h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-theme-secondary flex items-center gap-1 text-xs font-medium sm:text-sm">
                {searchQuery.value.trim() ? "Filtered Views~" : "Total Views~"}
                <Sparkle class="h-3 w-3 sm:h-4 sm:w-4" />
              </p>
              <p class="text-theme-primary text-lg font-bold sm:text-2xl">
                {searchQuery.value.trim()
                  ? filteredAndSortedUploads.value.reduce(
                      (sum, upload) => sum + upload.views,
                      0,
                    )
                  : userData.value.user.uploads.reduce(
                      (sum, upload) => sum + upload.views,
                      0,
                    )}
              </p>
            </div>
          </div>
        </div>
        <div class="card-cute pulse-soft rounded-3xl p-4 sm:p-6">
          <div class="flex items-center">
            {" "}
            <div class="bg-gradient-theme-tertiary-quaternary rounded-full p-2 sm:p-3">
              <HardDrive class="text-theme-primary h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-theme-secondary flex items-center gap-1 text-xs font-medium sm:text-sm">
                Storage Used~
                <Sparkle class="h-3 w-3 sm:h-4 sm:w-4" />
              </p>
              <p class="text-theme-primary text-lg font-bold sm:text-xl">
                {formatFileSize(userData.value.user.storageUsed)} /{" "}
                {formatFileSize(userData.value.effectiveStorageLimit)}
              </p>
            </div>
          </div>
        </div>
        <div class="card-cute pulse-soft rounded-3xl p-4 sm:p-6">
          <div class="flex items-center">
            {" "}
            <div class="bg-gradient-theme-quaternary-primary rounded-full p-2 sm:p-3">
              <Clock class="text-theme-primary h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-theme-secondary flex items-center gap-1 text-xs font-medium sm:text-sm">
                Available Space~
                <Sparkle class="h-3 w-3 sm:h-4 sm:w-4" />
              </p>
              <p class="text-theme-primary text-lg font-bold sm:text-2xl">
                {formatFileSize(
                  userData.value.effectiveStorageLimit -
                    userData.value.user.storageUsed,
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Uploads Section */}
      <div class="card-cute overflow-hidden rounded-3xl">
        {" "}
        <div class="border-theme-card border-b px-4 py-4 sm:px-6">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="text-gradient-cute flex flex-wrap items-center text-lg font-bold sm:text-xl">
              All Uploads~ 📋 <span class="sparkle ml-2">✨</span>
              {searchQuery.value.trim() && (
                <span class="text-theme-muted ml-2 text-sm font-normal">
                  ({filteredAndSortedUploads.value.length} of{" "}
                  {userData.value.user.uploads.length} files)
                </span>
              )}
            </h2>
            <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {/* View Mode Toggle */}
              <div class="bg-gradient-theme-toggle border-theme-card flex rounded-full border p-1">
                <button
                  onClick$={() => {
                    viewMode.value = "list";
                    setUploadsViewMode("list");
                  }}
                  class={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 ${
                    viewMode.value === "list"
                      ? "text-theme-primary bg-gradient-theme-primary-secondary shadow-lg"
                      : "text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary/10"
                  }`}
                >
                  <List class="h-4 w-4" />
                  List
                </button>
                <button
                  onClick$={() => {
                    viewMode.value = "grid";
                    setUploadsViewMode("grid");
                  }}
                  class={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 ${
                    viewMode.value === "grid"
                      ? "text-theme-primary bg-gradient-theme-primary-secondary shadow-lg"
                      : "text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary/10"
                  }`}
                >
                  <Grid class="h-4 w-4" />
                  Grid
                </button>
              </div>
              {/* Search Input */}
              <div class="group relative w-full max-w-md sm:w-auto">
                <div class="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
                  <div class="icon-theme-accent-primary-glow">
                    <Search class="h-4 w-4 transition-colors duration-300" />
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search files by name or type..."
                  value={searchQuery.value}
                  onInput$={(e) => {
                    searchQuery.value = (e.target as HTMLInputElement).value;
                  }}
                  class="border-theme-card text-theme-text-primary bg-gradient-theme-search w-full rounded-full border py-2 pr-4 pl-10 text-sm backdrop-blur-sm transition-all duration-500"
                />
                <div class="bg-gradient-theme-quaternary-primary-5 pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              </div>
            </div>
          </div>
          {/* Bulk Selection Controls */}
          <div class="border-theme-card border-t px-4 pt-3 sm:px-6">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3">

                <div
                  class={`transition-all duration-300 ${selectedFiles.value.size > 0 ? "opacity-100" : "opacity-50"}`}
                >
                  <div class="bg-gradient-theme-secondary/20 text-theme-accent-primary flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-sm">
                    <Sparkle class="h-3 w-3" />
                    <span class="text-sm font-medium">
                      {selectedFiles.value.size} file
                      {selectedFiles.value.size !== 1 ? "s" : ""} selected
                    </span>
                  </div>
                </div>
              </div>

              <div
                class={`flex items-center gap-2 transition-all duration-300 ${selectedFiles.value.size > 0 ? "opacity-100" : "pointer-events-none opacity-30"}`}
              >
                <button
                  onClick$={bulkCopyUrls}
                  class="text-theme-action-copy flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 hover:bg-white/10"
                >
                  <Copy class="h-4 w-4" />
                  Copy URLs ({selectedFiles.value.size})
                </button>
                <button
                  onClick$={bulkDelete}
                  class="text-theme-action-delete flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 hover:bg-white/10"
                >
                  <Trash2 class="h-4 w-4" />
                  Delete ({selectedFiles.value.size})
                </button>
              </div>
            </div>
          </div>
        </div>
        {userData.value.user.uploads.length > 0 ? (
          viewMode.value === "list" ? (
            /* LIST VIEW */
            <div class="overflow-x-auto">
              <table class="w-full min-w-[600px]">
                {" "}
                <thead class="glass">
                  <tr>
                    <th class="text-theme-text-muted px-3 py-3 text-left text-xs font-medium tracking-wider uppercase sm:px-6">
                      <button
                        onClick$={() => {
                          if (
                            selectedFiles.value.size ===
                            filteredAndSortedUploads.value.length
                          ) {
                            deselectAllFiles();
                          } else {
                            selectAllVisibleFiles();
                          }
                        }}
                        class="text-theme-accent-primary hover:text-theme-accent-secondary transition-colors"
                      >
                        {selectedFiles.value.size ===
                        filteredAndSortedUploads.value.length ? (
                          <CheckSquare class="h-4 w-4" />
                        ) : (
                          <Square class="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th
                      class="text-theme-text-muted hover:text-theme-text-secondary cursor-pointer px-3 py-3 text-left text-xs font-medium tracking-wider uppercase transition-colors sm:px-6"
                      onClick$={() => handleSort("name")}
                    >
                      File~ <FileText class="inline h-4 w-4" />
                      {getSortIcon("name")}
                    </th>
                    <th
                      class="text-theme-text-muted hover:text-theme-text-secondary cursor-pointer px-3 py-3 text-left text-xs font-medium tracking-wider uppercase transition-colors sm:px-6"
                      onClick$={() => handleSort("size")}
                    >
                      Size~ <Ruler class="inline h-4 w-4" />
                      {getSortIcon("size")}
                    </th>
                    <th
                      class="text-theme-text-muted hover:text-theme-text-secondary cursor-pointer px-3 py-3 text-left text-xs font-medium tracking-wider uppercase transition-colors sm:px-6"
                      onClick$={() => handleSort("views")}
                    >
                      Views~ <Eye class="inline h-4 w-4" />
                      {getSortIcon("views")}
                    </th>
                    <th
                      class="text-theme-text-muted hover:text-theme-text-secondary cursor-pointer px-3 py-3 text-left text-xs font-medium tracking-wider uppercase transition-colors sm:px-6"
                      onClick$={() => handleSort("date")}
                    >
                      Uploaded~ <Calendar class="inline h-4 w-4" />
                      {getSortIcon("date")}
                    </th>
                    <th class="text-theme-text-muted px-3 py-3 text-left text-xs font-medium tracking-wider uppercase sm:px-6">
                      Actions~ <Zap class="inline h-4 w-4" />
                    </th>
                  </tr>
                </thead>
                <tbody class="border-theme-card">
                  {" "}
                  {filteredAndSortedUploads.value.map((upload) => (
                    <tr
                      key={upload.id}
                      class={`border-theme-card transition-all duration-300 hover:bg-white/5 ${
                        selectedFiles.value.has(upload.deletionKey)
                          ? "bg-gradient-theme-accent-primary/10 border-theme-accent-primary/20"
                          : ""
                      }`}
                    >
                      <td class="px-3 py-4 sm:px-6">
                        <button
                          onClick$={() =>
                            toggleFileSelection(upload.deletionKey)
                          }
                          class="text-theme-accent-primary hover:text-theme-accent-secondary transition-colors"
                        >
                          {selectedFiles.value.has(upload.deletionKey) ? (
                            <CheckSquare class="h-4 w-4" />
                          ) : (
                            <Square class="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td class="px-3 py-4 sm:px-6">
                        <div class="flex items-center space-x-2 sm:space-x-3">
                          <div class="flex-shrink-0">
                            {upload.mimeType.startsWith("image/") ? (
                              <div
                                class="border-theme-card h-8 w-8 cursor-pointer overflow-hidden rounded-lg transition-all duration-300 sm:h-10 sm:w-10"
                                onClick$={() =>
                                  imagePreview.openPreview(
                                    `/f/${upload.shortCode}`,
                                    upload.originalName,
                                  )
                                }
                              >
                                <img
                                  src={`/f/${upload.shortCode}`}
                                  alt={upload.originalName}
                                  class="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
                                  width="40"
                                  height="40"
                                />
                              </div>
                            ) : upload.mimeType.startsWith("video/") ? (
                              <div class="bg-gradient-video flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10">
                                <div class="text-sm sm:text-base">🎬</div>
                              </div>
                            ) : upload.mimeType.startsWith("audio/") ? (
                              <div class="bg-gradient-audio flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10">
                                <div class="text-sm sm:text-base">🎵</div>
                              </div>
                            ) : upload.mimeType.includes("pdf") ? (
                              <div class="bg-gradient-pdf flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10">
                                <div class="text-sm sm:text-base">📄</div>
                              </div>
                            ) : upload.mimeType.includes("zip") ||
                              upload.mimeType.includes("rar") ||
                              upload.mimeType.includes("archive") ? (
                              <div class="bg-gradient-archive flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10">
                                <div class="text-sm sm:text-base">📦</div>
                              </div>
                            ) : upload.mimeType.includes("text") ? (
                              <div class="bg-gradient-text flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10">
                                <div class="text-sm sm:text-base">📝</div>
                              </div>
                            ) : (
                              <div class="glass flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10">
                                <div class="text-sm sm:text-base">📄</div>
                              </div>
                            )}
                          </div>
                          <div class="min-w-0 flex-1">
                            <p class="text-theme-text-primary truncate text-sm font-medium sm:text-base">
                              {upload.originalName}
                            </p>
                            <p class="text-theme-text-secondary truncate text-xs sm:text-sm">
                              {upload.mimeType}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td class="text-theme-text-secondary px-3 py-4 text-sm sm:px-6">
                        {formatFileSize(upload.size)}
                      </td>
                      <td class="text-theme-text-secondary px-3 py-4 text-sm sm:px-6">
                        {" "}
                        <div class="flex items-center gap-2">
                          <span>{upload.views}</span>
                          <div class="text-theme-trending">
                            <TrendingUp class="h-4 w-4" />
                          </div>
                        </div>
                      </td>
                      <td class="text-theme-text-secondary px-3 py-4 text-sm sm:px-6">
                        {new Date(upload.createdAt).toLocaleDateString()}
                      </td>
                      <td class="px-3 py-4 sm:px-6">
                        {" "}
                        <div class="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-2">
                          <button
                            onClick$={() =>
                              copyToClipboard(
                                `${userData.value.origin}/f/${upload.shortCode}`,
                              )
                            }
                            class="text-theme-action-copy rounded-full px-2 py-1 text-sm font-medium whitespace-nowrap transition-all duration-300 hover:bg-white/10 sm:px-3"
                          >
                            Copy URL <Copy class="inline h-4 w-4" />
                          </button>
                          <a
                            href={`/f/${upload.shortCode}`}
                            target="_blank"
                            class="text-theme-action-view rounded-full px-2 py-1 text-center text-sm font-medium whitespace-nowrap transition-all duration-300 hover:bg-white/10 sm:px-3"
                          >
                            View <Eye class="inline h-4 w-4" />
                          </a>
                          <button
                            onClick$={() => deleteUpload(upload.deletionKey)}
                            class="text-theme-action-delete rounded-full px-2 py-1 text-sm font-medium whitespace-nowrap transition-all duration-300 hover:bg-white/10 sm:px-3"
                          >
                            Delete <Trash2 class="inline h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* GRID VIEW */
            <div class="p-4 sm:p-6">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {filteredAndSortedUploads.value.map((upload) => (
                  <div
                    key={upload.id}
                    class={`card-cute group rounded-2xl p-4 transition-all duration-300 hover:scale-105 ${
                      selectedFiles.value.has(upload.deletionKey)
                        ? "ring-theme-accent-primary bg-gradient-theme-accent-primary/10 ring-2"
                        : ""
                    }`}
                  >
                    {/* Selection Checkbox */}
                    <div class="relative mb-2">
                      <button
                        onClick$={() => toggleFileSelection(upload.deletionKey)}
                        class="text-theme-accent-primary hover:text-theme-accent-secondary absolute top-0 right-0 z-10 rounded-full bg-white/20 p-1 backdrop-blur-sm transition-all duration-300"
                      >
                        {selectedFiles.value.has(upload.deletionKey) ? (
                          <CheckSquare class="h-5 w-5" />
                        ) : (
                          <Square class="h-5 w-5" />
                        )}
                      </button>
                    </div>

                    {/* File Preview */}
                    <div class="bg-gradient-grid-item mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-xl">
                      {upload.mimeType.startsWith("image/") ? (
                        <img
                          width={400}
                          height={400}
                          src={`/f/${upload.shortCode}`}
                          alt={upload.originalName}
                          class="h-full w-full cursor-pointer object-cover transition-transform duration-300 hover:scale-110"
                          onClick$={() =>
                            imagePreview.openPreview(
                              `/f/${upload.shortCode}`,
                              upload.originalName,
                            )
                          }
                        />
                      ) : upload.mimeType.startsWith("video/") ? (
                        <div class="text-6xl">🎬</div>
                      ) : upload.mimeType.startsWith("audio/") ? (
                        <div class="text-6xl">🎵</div>
                      ) : upload.mimeType.includes("pdf") ? (
                        <div class="text-6xl">📄</div>
                      ) : upload.mimeType.includes("zip") ||
                        upload.mimeType.includes("rar") ||
                        upload.mimeType.includes("archive") ? (
                        <div class="text-6xl">📦</div>
                      ) : upload.mimeType.includes("text") ? (
                        <div class="text-6xl">📝</div>
                      ) : (
                        <div class="text-6xl">📄</div>
                      )}
                    </div>
                    {/* File Info */}
                    <div class="space-y-2">
                      <h3
                        class="text-theme-text-primary truncate text-sm font-medium"
                        title={upload.originalName}
                      >
                        {upload.originalName}
                      </h3>
                      <div class="text-theme-text-secondary flex items-center justify-between text-xs">
                        <span>{formatFileSize(upload.size)}</span>
                        <span>
                          {new Date(upload.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {/* Analytics */}
                      <div class="space-y-2">
                        {" "}
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-1">
                            <div class="text-theme-accent-primary">
                              <Eye class="h-3 w-3" />
                            </div>
                            <span class="text-theme-text-secondary text-xs">
                              {upload.views} total
                            </span>
                          </div>
                          <div class="flex items-center gap-1">
                            <div class="text-theme-accent-secondary">
                              <TrendingUp class="h-3 w-3" />
                            </div>
                            <span class="text-theme-text-secondary text-xs">
                              {upload.weeklyViews || 0} this week
                            </span>
                          </div>
                        </div>
                        {/* Mini chart */}
                        <div class="flex items-center gap-2">
                          <span class="text-theme-text-muted text-xs">
                            7 days:
                          </span>
                          <MiniChart data={upload.analytics || []} />
                        </div>
                      </div>
                      {/* Actions */}
                      <div class="flex gap-1 pt-2">
                        <button
                          onClick$={() =>
                            copyToClipboard(
                              `${userData.value.origin}/f/${upload.shortCode}`,
                            )
                          }
                          class="text-theme-action-copy flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-all duration-300 hover:bg-white/10"
                        >
                          <Copy class="mr-1 inline h-3 w-3" />
                          Copy
                        </button>
                        <a
                          href={`/f/${upload.shortCode}`}
                          target="_blank"
                          class="text-theme-action-view flex-1 rounded-lg px-2 py-1 text-center text-xs font-medium transition-all duration-300 hover:bg-white/10"
                        >
                          <Eye class="mr-1 inline h-3 w-3" />
                          View
                        </a>
                        <button
                          onClick$={() => deleteUpload(upload.deletionKey)}
                          class="text-theme-action-delete flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-all duration-300 hover:bg-white/10"
                        >
                          <Trash2 class="mr-1 inline h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : userData.value.user.uploads.length === 0 ? (
          <div class="py-12 text-center">
            <div class="glass mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <div class="text-3xl">📁</div>
            </div>
            <h3 class="text-theme-text-primary mb-2 text-lg font-medium">
              No uploads yet~ ✨
            </h3>
            <p class="text-theme-text-secondary mb-4">
              Upload your first cute file to get started! (◕‿◕)♡
            </p>
            <Link
              href="/setup/sharex"
              class="btn-cute text-theme-text-primary inline-block rounded-full px-6 py-3 font-medium"
            >
              Setup ShareX to get started~ 🚀
            </Link>
          </div>
        ) : (
          <div class="py-12 text-center">
            {" "}
            <div class="glass mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <div class="text-theme-accent-primary">
                <Search class="h-8 w-8" />
              </div>
            </div>
            <h3 class="text-theme-text-primary mb-2 text-lg font-medium">
              No files found~ 🔍
            </h3>
            <p class="text-theme-text-secondary mb-4">
              Try searching with a different term! (◕‿◕)♡
            </p>
            <button
              onClick$={() => {
                searchQuery.value = "";
              }}
              class="btn-cute text-theme-text-primary inline-block rounded-full px-6 py-3 font-medium"
            >
              Clear Search~ ✨
            </button>
          </div>
        )}
      </div>
      {/* Floating Action Bar */}
      {selectedFiles.value.size > 0 && (
        <div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform">
          <div class="card-cute flex items-center gap-3 rounded-full px-6 py-3 shadow-xl backdrop-blur-sm">
            <span class="text-theme-text-primary text-sm font-medium">
              {selectedFiles.value.size} file
              {selectedFiles.value.size !== 1 ? "s" : ""} selected
            </span>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              onClick$={bulkCopyUrls}
              class="text-theme-action-copy flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 hover:bg-white/10"
            >
              <Copy class="h-4 w-4" />
              Copy URLs
            </button>
            <button
              onClick$={bulkDelete}
              class="text-theme-action-delete flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 hover:bg-white/10"
            >
              <Trash2 class="h-4 w-4" />
              Delete
            </button>
            <button
              onClick$={() => {
                selectedFiles.value = new Set();
              }}
              class="text-theme-muted hover:text-theme-text-secondary flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 hover:bg-white/10"
            >
              ✕ Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "My Uploads~ - twink.forsale",
  meta: [
    {
      name: "description",
      content:
        "Manage all your cute uploaded files and view their sparkly statistics! (◕‿◕)♡",
    },
  ],
};
