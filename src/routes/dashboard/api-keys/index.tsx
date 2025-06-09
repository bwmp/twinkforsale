import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, server$ } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { db } from "~/lib/db";
import { Key, Sparkle, Shield } from "lucide-icons-qwik";

export const useApiKeys = routeLoader$(async (requestEvent) => {
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
  
  if (!user) {
    throw requestEvent.redirect(302, "/");
  }
  
  return {
    user,
    apiKeys: user.apiKeys
  };
});

export const createApiKey = server$(async function(name: string) {
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

export const deleteApiKey = server$(async function(keyId: string) {
  const session = this.sharedMap.get("session");
  
  if (!session?.user?.email) {
    throw new Error("Not authenticated");
  }
  
  // Find the API key and verify ownership
  const apiKey = await db.apiKey.findUnique({
    where: { id: keyId },
    include: { user: true }
  });
  
  if (!apiKey || apiKey.user.email !== session.user.email) {
    throw new Error("API key not found or access denied");
  }
  
  // Soft delete by setting isActive to false
  await db.apiKey.update({
    where: { id: keyId },
    data: { isActive: false }
  });
  
  return { success: true };
});

export default component$(() => {
  const apiKeysData = useApiKeys();
  const newKeyName = useSignal("");
  const isCreating = useSignal(false);
  const showNewKey = useSignal<{ key: string; name: string } | null>(null);

  const handleCreateApiKey = $(async () => {
    if (!newKeyName.value.trim()) return;
    
    isCreating.value = true;
    try {
      const newKey = await createApiKey(newKeyName.value.trim());
      showNewKey.value = { key: newKey.key, name: newKey.name };
      newKeyName.value = "";
      // Reload the page to show updated list
      window.location.reload();
    } catch (error) {
      console.error("Failed to create API key:", error);
      alert("Failed to create API key");
    } finally {
      isCreating.value = false;
    }
  });

  const handleDeleteApiKey = $(async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to delete the API key "${keyName}"?`)) {
      return;
    }
    
    try {
      await deleteApiKey(keyId);
      // Reload the page to show updated list
      window.location.reload();
    } catch (error) {
      console.error("Failed to delete API key:", error);
      alert("Failed to delete API key");
    }
  });

  const copyToClipboard = $(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("API key copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Failed to copy API key");
    }
  });  return (
    <>      {/* Page Header */}
      <div class="mb-6 sm:mb-8 text-center">
        <h1 class="text-3xl sm:text-4xl font-bold text-gradient-cute mb-3 flex items-center justify-center gap-2 flex-wrap">
          API Keys Manager
          <Shield class="w-8 sm:w-10 h-8 sm:h-10" />
        </h1>
        <p class="text-pink-200 text-base sm:text-lg px-4">
          Create and manage API keys for ShareX integration~ Keep them safe and secure! (◕‿◕)♡
        </p>
      </div>

      {/* Account Status Check */}
      {!apiKeysData.value.user.isApproved && (
        <div class="mb-6 sm:mb-8 p-4 sm:p-6 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-xl">
          <div class="text-center">
            <h3 class="font-semibold text-lg mb-2">Account Pending Approval</h3>
            <p class="text-sm">
              You cannot create API keys until your account is approved by an administrator.
              Please wait for approval before proceeding.
            </p>
          </div>
        </div>
      )}

      {/* Create New API Key */}
      {apiKeysData.value.user.isApproved && (
        <div class="card-cute rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 class="text-lg sm:text-xl font-bold text-gradient-cute mb-4 flex items-center gap-2">
            Create New API Key
            <Sparkle class="w-4 sm:w-5 h-4 sm:h-5" />
            <Key class="w-4 sm:w-5 h-4 sm:h-5" />
          </h2>
          <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              placeholder="API Key Name (e.g., ShareX, Development) uwu"
              class="flex-1 glass rounded-full px-4 sm:px-6 py-3 text-white placeholder-pink-300/60 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all duration-300 text-sm sm:text-base"
              value={newKeyName.value}
              onInput$={(e) => {
                newKeyName.value = (e.target as HTMLInputElement).value;
              }}
              onKeyDown$={(e) => {
                if (e.key === "Enter") {
                  handleCreateApiKey();
                }
              }}
            />
            <button
              onClick$={handleCreateApiKey}
              disabled={!newKeyName.value.trim() || isCreating.value}
              class="btn-cute disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 sm:px-6 py-3 rounded-full font-medium text-sm sm:text-base w-full sm:w-auto"
            >
              {isCreating.value ? "Creating... ⏳" : "Create API Key 🚀"}
            </button>
          </div>
        </div>
      )}

      {/* New Key Display */}
      {showNewKey.value && (
        <div class="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 glass">
          <h3 class="text-base sm:text-lg font-bold text-green-400 mb-2 flex items-center flex-wrap">
            API Key Created! 🎉 <span class="ml-2 sparkle">✨</span>
          </h3>
          <p class="text-pink-200 mb-4 text-sm sm:text-base">
            Save this API key now~ For security reasons, it won't be shown again! (◕‿◕)♡
          </p>
          <div class="glass rounded-2xl p-3 sm:p-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-xs sm:text-sm text-pink-200 mb-1">Name: {showNewKey.value.name}</p>
                <p class="font-mono text-white break-all text-xs sm:text-sm bg-black/20 p-2 rounded-lg">{showNewKey.value.key}</p>
              </div>
              <button
                onClick$={() => copyToClipboard(showNewKey.value!.key)}
                class="btn-cute text-white px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm w-full sm:w-auto"
              >                Copy 📋
              </button>
            </div>
          </div>
          <button
            onClick$={() => showNewKey.value = null}
            class="mt-4 text-pink-300 hover:text-white text-sm underline"
          >
            I've saved it safely ✓
          </button>
        </div>
      )}

      {/* API Keys List */}
      <div class="card-cute rounded-3xl p-4 sm:p-6">
        <h2 class="text-lg sm:text-xl font-bold text-gradient-cute mb-4 flex items-center flex-wrap">
          Your API Keys 📝 <span class="ml-2 text-sm">🗝️</span>
        </h2>
        
        {apiKeysData.value.apiKeys.length === 0 ? (
          <div class="text-center py-8 sm:py-12">
            <div class="w-12 sm:w-16 h-12 sm:h-16 glass rounded-full flex items-center justify-center mx-auto mb-4">
              <div class="text-xl sm:text-2xl">🔑</div>
            </div>
            <h3 class="text-base sm:text-lg font-medium text-white mb-2">No API Keys Yet! ✨</h3>
            <p class="text-pink-200 text-sm sm:text-base px-4">
              Create your first API key to start using the API or configure ShareX~ (◕‿◕)♡
            </p>
          </div>
        ) : (
          <div class="space-y-3 sm:space-y-4">
            {apiKeysData.value.apiKeys.map((apiKey) => (
              <div key={apiKey.id} class="glass rounded-2xl p-3 sm:p-4 border border-pink-300/20 hover:border-pink-300/40 transition-all duration-300">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-base sm:text-lg font-medium text-white mb-1 flex items-center">
                      🔐 <span class="truncate ml-1">{apiKey.name}</span>
                    </h3>
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-pink-200">
                      <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                      {apiKey.lastUsed && (
                        <span>Last used: {new Date(apiKey.lastUsed).toLocaleDateString()}</span>
                      )}
                    </div>
                    <div class="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                      <span class="text-xs sm:text-sm text-pink-200">Key:</span>
                      <code class="bg-black/30 px-2 sm:px-3 py-1 rounded-full text-pink-300 font-mono text-xs sm:text-sm break-all">
                        {apiKey.key.substring(0, 8)}...{apiKey.key.substring(apiKey.key.length - 4)}
                      </code>
                      <button
                        onClick$={() => copyToClipboard(apiKey.key)}
                        class="text-pink-400 hover:text-pink-300 text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full hover:bg-pink-500/20 transition-all duration-300 w-full sm:w-auto text-center"
                      >
                        Copy Full Key 📋
                      </button>
                    </div>
                  </div>
                  <button
                    onClick$={() => handleDeleteApiKey(apiKey.id, apiKey.name)}
                    class="text-red-400 hover:text-red-300 p-2 sm:p-3 rounded-full hover:bg-red-500/20 transition-all duration-300 self-end sm:self-auto"
                    title="Delete API Key"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>        )}
      </div>

      {/* ShareX Integration Info */}
      {apiKeysData.value.user.isApproved && (
        <div class="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 rounded-3xl p-4 sm:p-6 mt-6 sm:mt-8 glass">
          <h3 class="text-base sm:text-lg font-bold text-blue-400 mb-2 flex items-center flex-wrap">
            ShareX Integration 🔗 <span class="ml-2 sparkle">✨</span>
          </h3>
          <p class="text-pink-200 mb-4 text-sm sm:text-base">
            Use your API key to configure ShareX for automatic uploads~ Visit the{" "}
            <a href="/dashboard/embed" class="text-pink-400 hover:text-pink-300 underline font-medium">
              Setup page
            </a>{" "}
            to download ShareX configuration files! (◕‿◕)♡
          </p>
          <div class="glass rounded-2xl p-3 sm:p-4 border border-cyan-400/20">
            <p class="text-xs sm:text-sm text-pink-200 mb-2">API Endpoint:</p>
            <code class="text-cyan-300 font-mono text-xs sm:text-sm break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/api/upload</code>
          </div>
        </div>
      )}
    </>
  );
});

export const head: DocumentHead = {
  title: "API Keys - twink.forsale",
  meta: [
    {
      name: "description",
      content: "Create and manage API keys for ShareX integration and programmatic access.",
    },
  ],
};
