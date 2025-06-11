import { component$, $, useContext, useSignal, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Link } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { db } from "~/lib/db";
import { getServerEnvConfig } from "~/lib/env";
import fs from "fs";
import path from "path";
import { Folder, Eye, HardDrive, Clock, Copy, Trash2, Sparkle, FileText, Ruler, Calendar, Zap, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-icons-qwik";
import { ImagePreviewContext } from "~/lib/image-preview-store";

export const useDeleteUpload = routeAction$(async (data, requestEvent) => {
  const session = requestEvent.sharedMap.get("session");

  if (!session?.user?.email) {
    return { success: false, error: "Not authenticated" };
  }

  const deletionKey = data.deletionKey as string;
  if (!deletionKey) {
    return { success: false, error: "No deletion key provided" };
  }

  try {
    // Find upload by deletion key and verify ownership
    const upload = await db.upload.findUnique({
      where: { deletionKey },
      include: { user: true }
    });

    if (!upload) {
      return { success: false, error: "File not found" };
    }

    // Verify user owns this upload
    if (upload.user?.email !== session.user.email) {
      return { success: false, error: "Unauthorized" };
    }    // Delete file from storage
    const config = getServerEnvConfig();
    const baseUploadDir = config.UPLOAD_DIR;
    
    // Determine the correct directory based on whether the upload has a user
    let filePath: string;
    if (upload.userId) {
      filePath = path.join(baseUploadDir, upload.userId, upload.filename);
    } else {
      filePath = path.join(baseUploadDir, 'anonymous', upload.filename);
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update user storage
    if (upload.userId) {
      await db.user.update({
        where: { id: upload.userId },
        data: {
          storageUsed: {
            decrement: upload.size
          }
        }
      });
    }

    // Delete from database
    await db.upload.delete({
      where: { id: upload.id }
    });

    return { success: true };
  } catch (error) {
    console.error("Deletion error:", error);
    return { success: false, error: "Failed to delete file" };
  }
});

export const useUserUploads = routeLoader$(async (requestEvent) => {
  const session = requestEvent.sharedMap.get("session");

  if (!session?.user?.email) {
    throw requestEvent.redirect(302, "/");
  }

  // Get environment configuration for storage limits
  const config = getServerEnvConfig();

  // Find user and their uploads
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: {
      uploads: {
        orderBy: { createdAt: "desc" }
      }
    }
  });
  if (!user) {
    throw requestEvent.redirect(302, "/");
  }

  // Calculate the effective storage limit (user's custom limit or default from env)
  const effectiveStorageLimit = user.maxStorageLimit || config.BASE_STORAGE_LIMIT;

  return {
    user,
    effectiveStorageLimit,
    origin: requestEvent.url.origin
  };
});

export default component$(() => {
  const userData = useUserUploads();
  const deleteUploadAction = useDeleteUpload();
  const imagePreview = useContext(ImagePreviewContext);
  const searchQuery = useSignal("");
  const sortBy = useSignal<'name' | 'size' | 'views' | 'date'>('date');
  const sortOrder = useSignal<'asc' | 'desc'>('desc');

  const copyToClipboard = $((text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  });

  const deleteUpload = $(async (deletionKey: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    const result = await deleteUploadAction.submit({ deletionKey });

    if (result.value.success) {
      // Reload the page to refresh the upload list
      window.location.reload();
    } else {
      alert(result.value.error || "Failed to delete file");
    }
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";

    // Handle negative numbers (over quota)
    const isNegative = bytes < 0;
    const absoluteBytes = Math.abs(bytes);

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(absoluteBytes) / Math.log(k));
    const formattedSize = parseFloat((absoluteBytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];

    return isNegative ? `-${formattedSize}` : formattedSize;
  };

  // Filter and sort uploads
  const filteredAndSortedUploads = useComputed$(() => {
    let uploads = userData.value.user.uploads || [];

    // Filter by search query
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim();
      uploads = uploads.filter((upload: any) => 
        upload.originalName.toLowerCase().includes(query) ||
        upload.mimeType.toLowerCase().includes(query)
      );
    }

    // Sort uploads
    uploads = [...uploads].sort((a: any, b: any) => {
      let comparison = 0;
      
      switch (sortBy.value) {
        case 'name':
          comparison = a.originalName.localeCompare(b.originalName);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'views':
          comparison = a.views - b.views;
          break;
        case 'date':
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      
      return sortOrder.value === 'asc' ? comparison : -comparison;
    });

    return uploads;
  });

  const handleSort = $((column: 'name' | 'size' | 'views' | 'date') => {
    if (sortBy.value === column) {
      // Toggle sort order if clicking the same column
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new column and default to descending
      sortBy.value = column;
      sortOrder.value = 'desc';
    }
  });

  const getSortIcon = (column: 'name' | 'size' | 'views' | 'date') => {
    if (sortBy.value !== column) {
      return <ArrowUpDown class="inline w-3 h-3 ml-1 text-pink-300/50" />;
    }
    return sortOrder.value === 'asc' 
      ? <ArrowUp class="inline w-3 h-3 ml-1 text-pink-300" />
      : <ArrowDown class="inline w-3 h-3 ml-1 text-pink-300" />;
  };

  return (
    <>      {/* Page Header */}
      <div class="mb-6 sm:mb-8 text-center">
        <h1 class="text-3xl sm:text-4xl font-bold text-gradient-cute mb-3 flex items-center justify-center gap-2 flex-wrap">
          My Uploads~
        </h1>
        <p class="text-pink-200 text-base sm:text-lg px-4">
          Manage all your cute uploads and view their sparkly statistics! (◕‿◕)♡
        </p>
      </div>      {/* Stats Summary */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div class="card-cute rounded-3xl p-4 sm:p-6 pulse-soft">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
              <Folder class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200 flex items-center gap-1">
                {searchQuery.value.trim() ? 'Filtered Files~' : 'Total Files~'}
                <Sparkle class="w-3 sm:w-4 h-3 sm:h-4" />
              </p>
              <p class="text-lg sm:text-2xl font-bold text-white">
                {searchQuery.value.trim() ? filteredAndSortedUploads.value.length : userData.value.user.uploads.length}
              </p>
            </div>
          </div>
        </div>
        <div class="card-cute rounded-3xl p-4 sm:p-6 pulse-soft">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-r from-pink-500 to-violet-500 rounded-full">
              <Eye class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200 flex items-center gap-1">
                {searchQuery.value.trim() ? 'Filtered Views~' : 'Total Views~'}
                <Sparkle class="w-3 sm:w-4 h-3 sm:h-4" />
              </p>
              <p class="text-lg sm:text-2xl font-bold text-white">
                {searchQuery.value.trim() 
                  ? filteredAndSortedUploads.value.reduce((sum, upload) => sum + upload.views, 0)
                  : userData.value.user.uploads.reduce((sum, upload) => sum + upload.views, 0)
                }
              </p>
            </div>
          </div>
        </div>
        <div class="card-cute rounded-3xl p-4 sm:p-6 pulse-soft">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full">
              <HardDrive class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200 flex items-center gap-1">
                Storage Used~
                <Sparkle class="w-3 sm:w-4 h-3 sm:h-4" />
              </p>
              <p class="text-lg sm:text-xl font-bold text-white">
                {formatFileSize(userData.value.user.storageUsed)} / {formatFileSize(userData.value.effectiveStorageLimit)}
              </p>
            </div>
          </div>
        </div>
        <div class="card-cute rounded-3xl p-4 sm:p-6 pulse-soft">
          <div class="flex items-center">
            <div class="p-2 sm:p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full">
              <Clock class="w-4 sm:w-6 h-4 sm:h-6 text-white" />
            </div>
            <div class="ml-3 sm:ml-4">
              <p class="text-xs sm:text-sm font-medium text-pink-200 flex items-center gap-1">
                Available Space~
                <Sparkle class="w-3 sm:w-4 h-3 sm:h-4" />
              </p>              <p class="text-lg sm:text-2xl font-bold text-white">
                {formatFileSize(userData.value.effectiveStorageLimit - userData.value.user.storageUsed)}
              </p>
            </div>
          </div>
        </div>
      </div>      {/* Uploads Table */}
      <div class="card-cute rounded-3xl overflow-hidden">
        <div class="px-4 sm:px-6 py-4 border-b border-pink-300/20">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 class="text-lg sm:text-xl font-bold text-gradient-cute flex items-center flex-wrap">
              All Uploads~ 📋 <span class="ml-2 sparkle">✨</span>
              {searchQuery.value.trim() && (
                <span class="text-sm font-normal text-pink-300 ml-2">
                  ({filteredAndSortedUploads.value.length} of {userData.value.user.uploads.length} files)
                </span>
              )}
            </h2>
              {/* Search Input */}
            <div class="relative max-w-md w-full sm:w-auto group">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                <Search class="h-4 w-4 text-pink-300 drop-shadow-sm transition-colors duration-300 group-focus-within:text-pink-200" />
              </div>
              <input
                type="text"
                placeholder="Search files by name or type..."
                value={searchQuery.value}
                onInput$={(e) => {
                  searchQuery.value = (e.target as HTMLInputElement).value;
                }}
                class="w-full pl-10 pr-4 py-2 text-sm rounded-full border text-white bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-sm border-cyan-300/30 placeholder-cyan-300/70 focus:border-cyan-400/60 focus:bg-gradient-to-r focus:from-cyan-500/20 focus:via-purple-500/20 focus:to-pink-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:shadow-lg focus:shadow-cyan-400/20 transition-all duration-500 hover:border-cyan-400/50 hover:shadow-md hover:shadow-cyan-400/10"
              />
              <div class="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/5 via-purple-400/5 to-pink-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </div>
          </div>
        </div>        {userData.value.user.uploads.length > 0 ? (
          <div class="overflow-x-auto">
            <table class="w-full min-w-[600px]">
              <thead class="glass">
                <tr>
                  <th 
                    class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-pink-300 uppercase tracking-wider cursor-pointer hover:text-pink-200 transition-colors"
                    onClick$={() => handleSort('name')}
                  >
                    File~ <FileText class="inline w-4 h-4" />
                    {getSortIcon('name')}
                  </th>
                  <th 
                    class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-pink-300 uppercase tracking-wider cursor-pointer hover:text-pink-200 transition-colors"
                    onClick$={() => handleSort('size')}
                  >
                    Size~ <Ruler class="inline w-4 h-4" />
                    {getSortIcon('size')}
                  </th>
                  <th 
                    class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-pink-300 uppercase tracking-wider cursor-pointer hover:text-pink-200 transition-colors"
                    onClick$={() => handleSort('views')}
                  >
                    Views~ <Eye class="inline w-4 h-4" />
                    {getSortIcon('views')}
                  </th>
                  <th 
                    class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-pink-300 uppercase tracking-wider cursor-pointer hover:text-pink-200 transition-colors"
                    onClick$={() => handleSort('date')}
                  >
                    Uploaded~ <Calendar class="inline w-4 h-4" />
                    {getSortIcon('date')}
                  </th>
                  <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-pink-300 uppercase tracking-wider">
                    Actions~ <Zap class="inline w-4 h-4" />
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-pink-300/20">
                {filteredAndSortedUploads.value.map((upload) => (
                  <tr key={upload.id} class="hover:bg-pink-500/10 transition-all duration-300">                    <td class="px-3 sm:px-6 py-4">
                    <div class="flex items-center space-x-2 sm:space-x-3">                        <div class="flex-shrink-0">
                      {upload.mimeType.startsWith('image/') ? (<div
                        class="w-8 sm:w-10 h-8 sm:h-10 rounded-lg overflow-hidden border border-pink-300/30 hover:border-pink-300/60 transition-all duration-300 cursor-pointer"
                        onClick$={() => imagePreview.openPreview(`/f/${upload.shortCode}`, upload.originalName)}
                      >
                        <img
                          src={`/f/${upload.shortCode}`}
                          alt={upload.originalName}
                          class="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                          width="40"
                          height="40"
                        />
                      </div>
                      ) : upload.mimeType.startsWith('video/') ? (
                        <div class="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                          <div class="text-sm sm:text-base">🎬</div>
                        </div>
                      ) : upload.mimeType.startsWith('audio/') ? (
                        <div class="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                          <div class="text-sm sm:text-base">🎵</div>
                        </div>
                      ) : upload.mimeType.includes('pdf') ? (
                        <div class="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-red-600 to-red-500 rounded-lg flex items-center justify-center">
                          <div class="text-sm sm:text-base">📄</div>
                        </div>
                      ) : upload.mimeType.includes('zip') || upload.mimeType.includes('rar') || upload.mimeType.includes('archive') ? (
                        <div class="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg flex items-center justify-center">
                          <div class="text-sm sm:text-base">📦</div>
                        </div>
                      ) : upload.mimeType.includes('text') ? (
                        <div class="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                          <div class="text-sm sm:text-base">📝</div>
                        </div>
                      ) : (
                        <div class="w-8 sm:w-10 h-8 sm:h-10 glass rounded-lg flex items-center justify-center">
                          <div class="text-sm sm:text-base">📄</div>
                        </div>
                      )}
                    </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-white font-medium text-sm sm:text-base truncate">{upload.originalName}</p>
                        <p class="text-pink-200 text-xs sm:text-sm truncate">{upload.mimeType}</p>
                      </div>
                    </div>
                  </td>
                    <td class="px-3 sm:px-6 py-4 text-pink-100 text-sm">
                      {formatFileSize(upload.size)}
                    </td>
                    <td class="px-3 sm:px-6 py-4 text-pink-100 text-sm">
                      {upload.views}
                    </td>
                    <td class="px-3 sm:px-6 py-4 text-pink-100 text-sm">
                      {new Date(upload.createdAt).toLocaleDateString()}
                    </td>
                    <td class="px-3 sm:px-6 py-4">
                      <div class="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">                        <button
                        onClick$={() => copyToClipboard(`${userData.value.origin}/f/${upload.shortCode}`)}
                        class="text-purple-400 hover:text-purple-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded-full hover:bg-purple-500/20 transition-all duration-300 whitespace-nowrap"
                      >
                        Copy URL <Copy class="inline w-4 h-4" />
                      </button>
                        <a
                          href={`/f/${upload.shortCode}`}
                          target="_blank"
                          class="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded-full hover:bg-cyan-500/20 transition-all duration-300 whitespace-nowrap text-center"
                        >
                          View <Eye class="inline w-4 h-4" />
                        </a>
                        <button
                          onClick$={() => deleteUpload(upload.deletionKey)}
                          class="text-red-400 hover:text-red-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded-full hover:bg-red-500/20 transition-all duration-300 whitespace-nowrap"
                        >
                          Delete <Trash2 class="inline w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>        ) : userData.value.user.uploads.length === 0 ? (
          <div class="text-center py-12">
            <div class="w-16 h-16 glass rounded-full flex items-center justify-center mx-auto mb-4">
              <div class="text-3xl">📁</div>
            </div>
            <h3 class="text-lg font-medium text-white mb-2">No uploads yet~ ✨</h3>
            <p class="text-pink-200 mb-4">
              Upload your first cute file to get started! (◕‿◕)♡
            </p>
            <Link
              href="/setup/sharex"
              class="btn-cute text-white px-6 py-3 rounded-full inline-block font-medium"
            >
              Setup ShareX to get started~ 🚀
            </Link>
          </div>
        ) : (
          <div class="text-center py-12">
            <div class="w-16 h-16 glass rounded-full flex items-center justify-center mx-auto mb-4">
              <Search class="h-8 w-8 text-pink-300" />
            </div>
            <h3 class="text-lg font-medium text-white mb-2">No files found~ 🔍</h3>
            <p class="text-pink-200 mb-4">
              Try searching with a different term! (◕‿◕)♡
            </p>
            <button
              onClick$={() => { searchQuery.value = ""; }}
              class="btn-cute text-white px-6 py-3 rounded-full inline-block font-medium"
            >
              Clear Search~ ✨
            </button>
          </div>
        )}
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "My Uploads~ - twink.forsale",
  meta: [
    {
      name: "description",
      content: "Manage all your cute uploaded files and view their sparkly statistics! (◕‿◕)♡",
    },
  ],
};
