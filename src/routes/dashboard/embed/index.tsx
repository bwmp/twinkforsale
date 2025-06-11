import { component$, useSignal, $, useTask$ } from "@builder.io/qwik";
import { routeLoader$, Form, routeAction$, z, zod$ } from "@builder.io/qwik-city";
import { ColorPicker, Toggle } from "@luminescent/ui-qwik";

export const useUserLoader = routeLoader$(async (requestEvent) => {
  // Import server-side dependencies inside the loader
  const { db } = await import("~/lib/db");
  
  const session = requestEvent.sharedMap.get("session");

  if (!session?.user?.email) {
    throw requestEvent.redirect(302, "/");
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    throw requestEvent.redirect(302, "/");
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      embedTitle: user.embedTitle,
      embedDescription: user.embedDescription,
      embedColor: user.embedColor, embedAuthor: user.embedAuthor,
      embedFooter: user.embedFooter, showFileInfo: Boolean(user.showFileInfo),
      showUploadDate: Boolean(user.showUploadDate),
      showUserStats: Boolean(user.showUserStats),
      customDomain: user.customDomain,
      customUploadDomain: user.customUploadDomain,
      useCustomWords: Boolean(user.useCustomWords)
    }
  };
});

export const useUpdateEmbedSettings = routeAction$(
  async (values, requestEvent) => {
    // Import server-side dependencies inside the action
    const { db } = await import("~/lib/db");
    
    const session = requestEvent.sharedMap.get("session");

    if (!session?.user?.email) {
      return requestEvent.fail(401, { message: "Unauthorized" });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return requestEvent.fail(404, { message: "User not found" });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        embedTitle: values.embedTitle || null,
        embedDescription: values.embedDescription || null,
        embedColor: values.embedColor || null, embedAuthor: values.embedAuthor || null, embedFooter: values.embedFooter || null,
        showFileInfo: Boolean(values.showFileInfo),
        showUploadDate: Boolean(values.showUploadDate),
        showUserStats: Boolean(values.showUserStats),
        customDomain: values.customDomain || null,
        customUploadDomain: values.customUploadDomain || null,
        useCustomWords: Boolean(values.useCustomWords)
      }
    });

    return { success: true, message: "Embed settings updated successfully" };
  },
  zod$({
    embedTitle: z.string().optional(),
    embedDescription: z.string().optional(),
    embedColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    embedAuthor: z.string().optional(), embedFooter: z.string().optional(), showFileInfo: z.preprocess((val) => val === "on" || val === true, z.boolean().default(false)),
    showUploadDate: z.preprocess((val) => val === "on" || val === true, z.boolean().default(false)),
    showUserStats: z.preprocess((val) => val === "on" || val === true, z.boolean().default(false)),
    customDomain: z.string().optional(),
    customUploadDomain: z.string().optional(),
    useCustomWords: z.preprocess((val) => val === "on" || val === true, z.boolean().default(false))
  })
);

export default component$(() => {
  const userData = useUserLoader();
  const updateAction = useUpdateEmbedSettings();
  const previewCode = useSignal("");  // Reactive form state
  const showFileInfo = useSignal(userData.value.user.showFileInfo);
  const showUploadDate = useSignal(userData.value.user.showUploadDate);
  const showUserStats = useSignal(userData.value.user.showUserStats);
  const useCustomWords = useSignal(userData.value.user.useCustomWords);

  // Form field signals to track current values
  const titleValue = useSignal(userData.value.user.embedTitle || "");
  const descriptionValue = useSignal(userData.value.user.embedDescription || "");
  const colorValue = useSignal(userData.value.user.embedColor || "#8B5CF6");
  const authorValue = useSignal(userData.value.user.embedAuthor || "");
  const footerValue = useSignal(userData.value.user.embedFooter || "");  // Initialize preview code with user data (non-reactive)
  const user = userData.value.user;

  const inputClasses = "w-full px-3 sm:px-4 py-2 sm:py-3 glass rounded-full text-white placeholder-pink-300/60 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all duration-300 text-sm sm:text-base"
  const toggleClasses = "flex gap-2 items-center p-3 glass rounded-full hover:bg-pink-500/10 transition-all duration-300 cursor-pointer"
  // Use useTask$ to set initial preview without violating Qwik's reactivity rules
  useTask$(() => {
    const title = user.embedTitle || "File Upload";
    const description = user.embedDescription || "Uploaded via twink.forsale";
    const color = user.embedColor || "#8B5CF6";
    const author = user.embedAuthor || user.name || "User";
    const footer = user.embedFooter || "twink.forsale";

    // Replace placeholders with example values for initial preview
    const replacedTitle = title
      .replace(/\{filename\}/g, "example-image.png")
      .replace(/\{filesize\}/g, "2.34 MB")
      .replace(/\{filetype\}/g, "image/png")
      .replace(/\{uploaddate\}/g, new Date().toLocaleDateString())
      .replace(/\{views\}/g, "42")
      .replace(/\{username\}/g, user.name || "User")
      .replace(/\{totalfiles\}/g, "127")
      .replace(/\{totalstorage\}/g, "2.1 GB")
      .replace(/\{totalviews\}/g, "5,432");

    let initialDesc = description
      .replace(/\{filename\}/g, "example-image.png")
      .replace(/\{filesize\}/g, "2.34 MB")
      .replace(/\{filetype\}/g, "image/png")
      .replace(/\{uploaddate\}/g, new Date().toLocaleDateString())
      .replace(/\{views\}/g, "42")
      .replace(/\{username\}/g, user.name || "User")
      .replace(/\{totalfiles\}/g, "127")
      .replace(/\{totalstorage\}/g, "2.1 GB")
      .replace(/\{totalviews\}/g, "5,432");

    if (user.showFileInfo) {
      initialDesc += "\\n\\n📁 **example-image.png**\\n📏 2.34 MB • image/png";
    }
    if (user.showUploadDate) {
      initialDesc += "\\n📅 Uploaded " + new Date().toLocaleDateString();
    }

    // Set initial footer based on user stats setting
    let initialFooter = footer;
    if (user.showUserStats) {
      initialFooter = "📁 127 files   💾 2.1 GB   👁️ 5,432 views";
    }

    previewCode.value = `{
      "type": "rich",
      "title": "${replacedTitle}",
      "description": "${initialDesc}",
      "color": ${parseInt(color.slice(1), 16)},
      "author": {
        "name": "${author}"
      },
      "footer": {
        "text": "${initialFooter}"
      },
      "image": {
        "url": "https://twink.forsale/f/abc123"
      }
    }`;
  });
  const generatePreview = $(() => {
    const title = titleValue.value || "File Upload";
    const description = descriptionValue.value || "Uploaded via twink.forsale";
    const color = colorValue.value || "#8B5CF6";
    const author = authorValue.value || userData.value.user.name || "User";
    const footer = footerValue.value || "twink.forsale";

    // Replace placeholders with example values
    const replacedTitle = title
      .replace(/\{filename\}/g, "example-image.png")
      .replace(/\{filesize\}/g, "2.34 MB")
      .replace(/\{filetype\}/g, "image/png")
      .replace(/\{uploaddate\}/g, new Date().toLocaleDateString())
      .replace(/\{views\}/g, "42")
      .replace(/\{username\}/g, userData.value.user.name || "User")
      .replace(/\{totalfiles\}/g, "127")
      .replace(/\{totalstorage\}/g, "2.1 GB")
      .replace(/\{totalviews\}/g, "5,432");

    let desc = description
      .replace(/\{filename\}/g, "example-image.png")
      .replace(/\{filesize\}/g, "2.34 MB")
      .replace(/\{filetype\}/g, "image/png")
      .replace(/\{uploaddate\}/g, new Date().toLocaleDateString())
      .replace(/\{views\}/g, "42")
      .replace(/\{username\}/g, userData.value.user.name || "User")
      .replace(/\{totalfiles\}/g, "127")
      .replace(/\{totalstorage\}/g, "2.1 GB")
      .replace(/\{totalviews\}/g, "5,432"); if (showFileInfo.value) {
        desc += "\\n\\n📁 **example-image.png**\\n📏 2.34 MB • image/png";
      }
    if (showUploadDate.value) {
      desc += "\\n📅 Uploaded " + new Date().toLocaleDateString();
    }

    // Update footer based on user stats setting
    let finalFooter = footer;
    if (showUserStats.value) {
      finalFooter = "📁 127 files   💾 2.1 GB   👁️ 5,432 views";
    }

    previewCode.value = `{
      "type": "rich",
      "title": "${replacedTitle}",
      "description": "${desc}",
      "color": ${parseInt(color.slice(1), 16)},
      "author": {
        "name": "${author}"
      },
      "footer": {
        "text": "${finalFooter}"
      },
      "image": {
        "url": "https://twink.forsale/f/abc123"
      }
    }`;
  });
  return (
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-6 sm:mb-8 text-center">
        <h1 class="text-3xl sm:text-4xl font-bold text-gradient-cute mb-3 flex items-center justify-center gap-2 flex-wrap">
          Discord Embed Settings~
        </h1>
        <p class="text-pink-200 text-base sm:text-lg px-4">
          Customize how your cute uploads appear when shared on Discord and other platforms! (◕‿◕)♡
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Settings Form */}
        <div class="card-cute rounded-3xl p-4 sm:p-6">
          <h2 class="text-lg sm:text-xl font-bold text-gradient-cute mb-4 sm:mb-6 flex items-center">
            Embed Configuration~ ⚙️ <span class="ml-2 sparkle">✨</span>
          </h2>
          <Form action={updateAction} onSubmit$={generatePreview}>
            <div class="space-y-4 sm:space-y-6">
              <div>
                <label class="block text-xs sm:text-sm font-medium text-pink-200 mb-2">
                  Embed Title~ 💝
                </label>
                <input
                  type="text"
                  name="embedTitle"
                  value={titleValue.value}
                  placeholder="File Upload~ ✨"
                  class={inputClasses}
                  onInput$={(event) => {
                    titleValue.value = (event.target as HTMLInputElement).value;
                    generatePreview();
                  }}
                />
                <p class="text-xs text-pink-300/70 mt-2 pl-3 sm:pl-4">
                  Use placeholders: {'{filename}'}, {'{filesize}'}, {'{filetype}'}, {'{uploaddate}'}, {'{views}'}, {'{username}'}, {'{totalfiles}'}, {'{totalstorage}'}, {'{totalviews}'}~ ✨
                </p>
              </div>
              <div>
                <label class="block text-xs sm:text-sm font-medium text-pink-200 mb-2">
                  Description~ 📝
                </label>
                <textarea
                  name="embedDescription"
                  value={descriptionValue.value}
                  placeholder="Uploaded via twink.forsale~ (◕‿◕)♡"
                  rows={3}
                  class="w-full px-3 sm:px-4 py-2 sm:py-3 glass rounded-2xl text-white placeholder-pink-300/60 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all duration-300 resize-none text-sm sm:text-base"
                  onInput$={(event) => {
                    descriptionValue.value = (event.target as HTMLTextAreaElement).value;
                    generatePreview();
                  }}
                />
                <p class="text-xs text-pink-300/70 mt-2 pl-3 sm:pl-4">
                  Use placeholders: {'{filename}'}, {'{filesize}'}, {'{filetype}'}, {'{uploaddate}'}, {'{views}'}, {'{username}'}, {'{totalfiles}'}, {'{totalstorage}'}, {'{totalviews}'}~ ✨
                </p>
              </div>

              <div>
                <label class="block text-xs sm:text-sm font-medium text-pink-200 mb-2">
                  Embed Color~ 🎨
                </label>
                <ColorPicker
                  id="color-picker"
                  horizontal
                  value={colorValue.value} onInput$={newColor => {
                    colorValue.value = newColor;
                    generatePreview();
                  }} />
              </div>

              <div>
                <label class="block text-xs sm:text-sm font-medium text-pink-200 mb-2">
                  Author Name~ ✏️
                </label>
                <input
                  type="text"
                  name="embedAuthor"
                  value={authorValue.value}
                  placeholder={userData.value.user.name || "Cute User~ 💕"}
                  class={inputClasses}
                  onInput$={(event) => {
                    authorValue.value = (event.target as HTMLInputElement).value;
                    generatePreview();
                  }}
                />
              </div>

              <div>
                <label class="block text-xs sm:text-sm font-medium text-pink-200 mb-2">
                  Footer Text~ 📄
                </label>
                <input
                  type="text"
                  name="embedFooter"
                  value={footerValue.value}
                  placeholder="twink.forsale~ ✨"
                  class={inputClasses}
                  onInput$={(event) => {
                    footerValue.value = (event.target as HTMLInputElement).value;
                    generatePreview();
                  }}
                />
              </div>
              <div>
                <label class="block text-xs sm:text-sm font-medium text-pink-200 mb-2">
                  Custom Domain (Optional)~ 🌐
                </label>
                <input
                  type="text"
                  name="customDomain"
                  value={userData.value.user.customDomain || ""}
                  placeholder="your-domain.com"
                  class={inputClasses}
                />
                <p class="text-xs text-pink-300/70 mt-2 pl-3 sm:pl-4">
                  Override the domain shown in embeds (for custom domains)~ ✨
                </p>
              </div>

              <div>
                <label class="block text-xs sm:text-sm font-medium text-pink-200 mb-2">
                  Upload Domain (Optional)~ 🔗
                </label>
                <input
                  type="text"
                  name="customUploadDomain"
                  value={userData.value.user.customUploadDomain || ""}
                  placeholder="files.your-domain.com"
                  class={inputClasses}
                />
                <p class="text-xs text-pink-300/70 mt-2 pl-3 sm:pl-4">
                  Custom domain for file URLs (e.g., subdomain.twink.forsale)~ 🌟
                </p>
              </div>
              <div class="space-y-3 sm:space-y-4">
                <label class={toggleClasses}>
                  <Toggle
                    checkbox
                    onColor="purple"
                    checked={showFileInfo.value}
                    onChange$={(e, el) => {
                      showFileInfo.value = el.checked;
                      generatePreview();
                    }}
                  />
                  <span class="text-xs sm:text-sm text-pink-200">Show file information (name, size, type)~ 📊</span>
                </label>
                <label class={toggleClasses}>
                  <Toggle
                    checkbox
                    onColor="purple"
                    checked={showUploadDate.value}
                    onChange$={(e, el) => {
                      showUploadDate.value = el.checked;
                      generatePreview();
                    }}
                  />
                  <span class="text-xs sm:text-sm text-pink-200">Show upload date~ 📅</span>
                </label>
                <label class={toggleClasses}>
                  <Toggle
                    checkbox
                    onColor="purple"
                    checked={showUserStats.value}
                    onChange$={(e, el) => {
                      showUserStats.value = el.checked;
                      generatePreview();
                    }
                    }
                  />
                  <span class="text-xs sm:text-sm text-pink-200">Show user statistics (files uploaded, storage used, total views)~ 📊</span>
                </label>
                <label class={toggleClasses}>
                  <Toggle
                    checkbox
                    onColor="purple"
                    checked={useCustomWords.value}
                    onChange$={(e, el) => {
                      useCustomWords.value = el.checked;
                      generatePreview();
                    }}
                  />
                  <span class="text-xs sm:text-sm text-pink-200">Use cute words for file URLs~ 💕</span>
                </label>
                <p class="text-xs text-pink-300/70 ml-8 -mt-2">
                  Generate adorable URLs like "bunny-sparkle-123" instead of random characters~ (◕‿◕)♡
                </p>
              </div>

              <button
                type="submit"
                class="w-full btn-cute text-white font-medium py-2 sm:py-3 px-4 sm:px-6 rounded-full transition-all duration-300 text-sm sm:text-base"
              >
                Save Settings~ 💾✨
              </button>
            </div>
          </Form>

          {updateAction.value?.success && (
            <div class="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-2xl glass">
              <p class="text-green-300 text-xs sm:text-sm flex items-center">
                ✅ {updateAction.value.message}~ ✨
              </p>
            </div>
          )}

          {updateAction.value?.failed && (
            <div class="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-400/30 rounded-2xl glass">
              <p class="text-red-300 text-xs sm:text-sm flex items-center">
                ❌ {updateAction.value.message}~ 💔
              </p>
            </div>
          )}
        </div>

        {/* Preview */}
        <div class="card-cute rounded-3xl p-4 sm:p-6">
          <h2 class="text-lg sm:text-xl font-bold text-gradient-cute mb-4 sm:mb-6 flex items-center">
            Discord Embed Preview~<span class="ml-2 sparkle">✨</span>
          </h2>

          <div class="glass rounded-2xl p-3 sm:p-4 border-l-4 border-gradient-to-b from-purple-500 to-pink-500">
            <div class="text-xs text-pink-300/70 mb-3 flex items-center">
              Example embed structure~ 📋 <span class="ml-1">💕</span>
            </div>
            <pre class="text-xs text-pink-100 whitespace-pre-wrap overflow-x-auto font-mono bg-black/20 p-3 rounded-lg">
              {previewCode.value}
            </pre>
          </div>

          <div class="mt-6 p-4 glass rounded-2xl border border-cyan-400/20">
            <h3 class="text-sm font-medium text-cyan-300 mb-3 flex items-center">
              How it works~ ⚙️ <span class="ml-2">✨</span>
            </h3>
            <ul class="text-xs text-pink-200 space-y-2">
              <li class="flex items-center">• Discord bots/crawlers see the embed metadata~ 🤖</li>
              <li class="flex items-center">• Regular users are redirected to the actual file~ 📁</li>
              <li class="flex items-center">• Images show inline previews in Discord~ 🖼️</li>
              <li class="flex items-center">• Custom domains override the site name~ 🌐</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
});
