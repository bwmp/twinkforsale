import { component$, $, useContext } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Link } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { db } from "~/lib/db";
import { getServerEnvConfig } from "~/lib/env";
import fs from "fs";
import path from "path";
import { Folder, Eye, HardDrive, Clock, Copy, Trash2, Sparkle, FileText, Ruler, Calendar, Zap } from "lucide-icons-qwik";
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
    }

    // Delete file from storage
    const config = getServerEnvConfig();
    const uploadDir = config.UPLOAD_DIR;
    const filePath = path.join(uploadDir, upload.filename);

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
                Total Files~
                <Sparkle class="w-3 sm:w-4 h-3 sm:h-4" />
              </p>
              <p class="text-lg sm:text-2xl font-bold text-white">{userData.value.user.uploads.length}</p>
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
                Total Views~
                <Sparkle class="w-3 sm:w-4 h-3 sm:h-4" />
              </p>
              <p class="text-lg sm:text-2xl font-bold text-white">
                {userData.value.user.uploads.reduce((sum, upload) => sum + upload.views, 0)}
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
          <h2 class="text-lg sm:text-xl font-bold text-gradient-cute flex items-center flex-wrap">
            All Uploads~ 📋 <span class="ml-2 sparkle">✨</span>
          </h2>
        </div>
        {userData.value.user.uploads.length > 0 ? (
          <div class="overflow-x-auto">
            <table class="w-full min-w-[600px]">
              <thead class="glass">
                <tr>
                  <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-pink-300 uppercase tracking-wider">
                    File~ <FileText class="inline w-4 h-4" />
                  </th>
                  <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-pink-300 uppercase tracking-wider">
                    Size~ <Ruler class="inline w-4 h-4" />
                  </th>
                  <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-pink-300 uppercase tracking-wider">
                    Views~ <Eye class="inline w-4 h-4" />
                  </th>
                  <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-pink-300 uppercase tracking-wider">
                    Uploaded~ <Calendar class="inline w-4 h-4" />
                  </th>
                  <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-pink-300 uppercase tracking-wider">
                    Actions~ <Zap class="inline w-4 h-4" />
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-pink-300/20">
                {userData.value.user.uploads.map((upload) => (
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
          </div>
        ) : (
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
              Setup ShareX to get started~ 🚀            </Link>          </div>
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
