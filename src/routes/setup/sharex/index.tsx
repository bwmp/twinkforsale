import { component$, $ } from "@builder.io/qwik";
import { routeLoader$, server$ } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { db } from "~/lib/db";
import { Camera, Key, Sparkle, Shield } from "lucide-icons-qwik";

export const useUserApiKeys = routeLoader$(async (requestEvent) => {
  const session = requestEvent.sharedMap.get("session");

  if (!session?.user?.email) {
    throw requestEvent.redirect(302, "/");
  }

  // Find user
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: {
      apiKeys: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  // Get the base URL from the request
  const baseUrl = requestEvent.url.origin;
  return { user, baseUrl };
});

export const createApiKey = server$(async function (name: string) {
  const session = this.sharedMap.get("session");

  if (!session?.user?.email) {
    throw new Error("Not authenticated");
  }
  // Find user
  const user = await db.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Check if user is approved
  if (!user.isApproved) {
    throw new Error("Account pending approval. Please wait for admin approval before creating API keys.");
  }

  // Create new API key
  const apiKey = await db.apiKey.create({
    data: {
      name,
      userId: user.id
    }
  });

  return {
    id: apiKey.id,
    key: apiKey.key,
    name: apiKey.name,
    createdAt: apiKey.createdAt
  };
});

export default component$(() => {
  const userData = useUserApiKeys();

  const handleCreateApiKey = $(async () => {
    try {
      await createApiKey("ShareX API Key");
      window.location.reload();
    } catch (error) {
      console.error("Failed to create API key:", error);
      alert("Failed to create API key");
    }
  });

  const generateShareXConfig = $((apiKey: string) => {
    const baseUrl = userData.value.baseUrl;

    const config = {
      "Version": "13.4.0",
      "Name": "twink.forsale",
      "DestinationType": "ImageUploader, TextUploader, FileUploader",
      "RequestMethod": "POST",
      "RequestURL": `${baseUrl}/api/upload`,
      "Headers": {
        "Authorization": `Bearer ${apiKey}`
      },
      "Body": "MultipartFormData",
      "FileFormName": "file",
      "URL": "$json:url$",
      "ThumbnailURL": "$json:thumbnail_url$",
      "DeletionURL": "$json:deletion_url$"
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "twink-forsale.sxcu";
    a.click();
    URL.revokeObjectURL(url);
  });
  return (
    <>
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div class="text-center mb-8 sm:mb-12">
          <h1 class="text-2xl sm:text-3xl md:text-4xl font-bold text-gradient-cute mb-4 flex items-center justify-center gap-2">
            ShareX Setup~
            <Camera class="w-6 sm:w-8 md:w-10 h-6 sm:h-8 md:h-10" />
          </h1>
          <p class="text-lg sm:text-xl text-pink-200 px-2">
            Configure ShareX to work with twink.forsale in just a few clicks! (◕‿◕)♡
          </p>
        </div>        {/* Step 1: API Key */}
        <div class="card-cute rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <div class="flex flex-col sm:flex-row items-start gap-4">
            <div class="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold pulse-soft text-sm sm:text-base">
              1
            </div>
            <div class="flex-1 w-full">
              <h2 class="text-xl sm:text-2xl font-bold text-gradient-cute mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span>Get Your API Key~</span>
                <div class="flex items-center gap-1">
                  <Key class="w-4 sm:w-6 h-4 sm:h-6" />
                  <Sparkle class="w-4 sm:w-5 h-4 sm:h-5" />
                </div>
              </h2>              {userData.value.user?.apiKeys && userData.value.user.apiKeys.length > 0 ? (
                <div class="space-y-3 sm:space-y-4">
                  {userData.value.user.apiKeys.map((apiKey) => (
                    <div key={apiKey.id} class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 glass rounded-xl sm:rounded-2xl border border-pink-300/20 hover:border-pink-300/40 transition-all duration-300">
                      <div class="flex-1 min-w-0">
                        <p class="text-white font-medium flex items-center gap-2 text-sm sm:text-base">
                          <Shield class="w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" />
                          <span class="truncate">{apiKey.name}</span>
                        </p>
                        <p class="text-pink-200 text-xs sm:text-sm font-mono bg-black/20 px-2 py-1 rounded mt-1 break-all">{apiKey.key}</p>
                      </div>
                      <button
                        onClick$={() => generateShareXConfig(apiKey.key)}
                        class="btn-cute text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full font-medium text-sm sm:text-base w-full sm:w-auto flex-shrink-0"
                      >
                        Download Config~ 📥✨
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div class="text-center py-6 sm:py-8">
                  <div class="w-12 sm:w-16 h-12 sm:h-16 glass rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <div class="text-2xl sm:text-3xl">🔑</div>
                  </div>
                  <p class="text-pink-200 mb-3 sm:mb-4 text-sm sm:text-base px-2">You need an API key to use ShareX with twink.forsale~ ✨</p>

                  {/* Create API Key Form */}
                  <button
                    onClick$={handleCreateApiKey}
                    class="btn-cute disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 sm:px-6 py-3 rounded-full font-medium text-sm sm:text-base w-full sm:w-auto"
                  >
                    Create API Key 🚀
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>        {/* Step 2: Download ShareX */}
        <div class="card-cute rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <div class="flex flex-col sm:flex-row items-start gap-4">
            <div class="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold pulse-soft text-sm sm:text-base">
              2
            </div>
            <div class="flex-1 w-full">
              <h2 class="text-xl sm:text-2xl font-bold text-gradient-cute mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span>Install ShareX~</span>
                <div class="flex items-center gap-1">
                  <span class="text-lg sm:text-xl">📱</span>
                  <span class="ml-1 sparkle text-sm sm:text-base">✨</span>
                </div>
              </h2>
              <p class="text-pink-200 mb-3 sm:mb-4 text-sm sm:text-base">
                If you don't have ShareX installed, download it from the official website~ (◕‿◕)♡
              </p>
              <a
                href="https://getsharex.com/"
                target="_blank"
                class="glass text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full inline-block hover:bg-cyan-500/20 transition-all duration-300 border border-cyan-400/20 hover:border-cyan-400/40 text-sm sm:text-base"
              >
                Download ShareX~ 📥
              </a>
            </div>
          </div>
        </div>        {/* Step 3: Import Config */}
        <div class="card-cute rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <div class="flex flex-col sm:flex-row items-start gap-4">
            <div class="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold pulse-soft text-sm sm:text-base">
              3
            </div>
            <div class="flex-1 w-full">
              <h2 class="text-xl sm:text-2xl font-bold text-gradient-cute mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span>Import Configuration~</span>
                <div class="flex items-center gap-1">
                  <span class="text-lg sm:text-xl">⚙️</span>
                  <span class="ml-1 sparkle text-sm sm:text-base">✨</span>
                </div>
              </h2>
              <div class="space-y-3 sm:space-y-4">
                <div class="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 text-pink-200 text-sm sm:text-base">
                  <span class="w-6 sm:w-8 h-6 sm:h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0">1</span>
                  <span>Download your configuration file using the button above~ 📥</span>
                </div>
                <div class="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 text-pink-200 text-sm sm:text-base">
                  <span class="w-6 sm:w-8 h-6 sm:h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0">2</span>
                  <span>Double-click the downloaded .sxcu file to import it into ShareX~ 🖱️</span>
                </div>
                <div class="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 text-pink-200 text-sm sm:text-base">
                  <span class="w-6 sm:w-8 h-6 sm:h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0">3</span>
                  <span>ShareX will automatically configure twink.forsale as your upload destination~ ✨</span>
                </div>
              </div>
            </div>
          </div>
        </div>        {/* Step 4: Start Uploading */}
        <div class="card-cute rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8">
          <div class="flex flex-col sm:flex-row items-start gap-4">
            <div class="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold pulse-soft text-sm sm:text-base">
              4
            </div>
            <div class="flex-1 w-full">
              <h2 class="text-xl sm:text-2xl font-bold text-gradient-cute mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span>Start Uploading!~</span>
                <div class="flex items-center gap-1">
                  <span class="text-lg sm:text-xl">🚀</span>
                  <span class="ml-1 sparkle text-sm sm:text-base">✨</span>
                </div>
              </h2>
              <p class="text-pink-200 mb-3 sm:mb-4 text-sm sm:text-base">
                You're all set! Use ShareX's capture tools or drag files to upload them to twink.forsale~ (◕‿◕)♡
              </p>
              <div class="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-emerald-400/20">
                <h3 class="text-emerald-300 font-semibold mb-2 sm:mb-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm sm:text-base">
                  <span>Quick Tips~</span>
                  <div class="flex items-center gap-1">
                    <span class="text-sm sm:text-base">💡</span>
                    <span class="ml-1 text-xs sm:text-sm">✨</span>
                  </div>
                </h3>
                <ul class="text-pink-200 space-y-1 sm:space-y-2 text-xs sm:text-sm">
                  <li class="flex items-start gap-2">
                    <span class="mt-0.5">•</span>
                    <span>Use Ctrl+Shift+4 for region capture (default hotkey)~ ⌨️</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="mt-0.5">•</span>
                    <span>Drag and drop files directly onto ShareX~ 🖱️</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="mt-0.5">•</span>
                    <span>View your uploads in the Dashboard~ 📊</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="mt-0.5">•</span>
                    <span>Each upload gets a short, shareable URL~ 🔗</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "ShareX Setup~ - twink.forsale",
  meta: [
    {
      name: "description",
      content: "Configure ShareX to work with twink.forsale file sharing service~ (◕‿◕)♡",
    },
  ],
};
