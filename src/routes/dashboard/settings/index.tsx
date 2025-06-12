import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  Form,
  routeAction$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { themes, type ThemeName } from "~/lib/theme-store";
import {
  Palette,
  Sparkles,
  Sun,
  Moon,
  Heart,
  Zap,
  Eye,
  Settings as SettingsIcon,
} from "lucide-icons-qwik";

export const useUserLoader = routeLoader$(async (requestEvent) => {
  const { db } = await import("~/lib/db");

  const session = requestEvent.sharedMap.get("session");

  if (!session?.user?.email) {
    throw requestEvent.redirect(302, "/");
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: {
      uploadDomain: true,
    },
  });

  if (!user) {
    throw requestEvent.redirect(302, "/");
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      uploadDomainId: user.uploadDomainId,
      customSubdomain: user.customSubdomain,
      uploadDomain: user.uploadDomain,
    },
  };
});

export const useUploadDomainsLoader = routeLoader$(async () => {
  const { db } = await import("~/lib/db");

  const domains = await db.uploadDomain.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return domains;
});

export const useUpdateSettingsAction = routeAction$(
  async (values, requestEvent) => {
    const { db } = await import("~/lib/db");

    const session = requestEvent.sharedMap.get("session");

    if (!session?.user?.email) {
      return requestEvent.fail(401, { message: "Unauthorized" });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return requestEvent.fail(404, { message: "User not found" });
    }

    // Validate that the upload domain exists if provided
    if (values.uploadDomainId) {
      const domain = await db.uploadDomain.findUnique({
        where: { id: values.uploadDomainId, isActive: true },
      });

      if (!domain) {
        return requestEvent.fail(400, {
          message: "Invalid upload domain selected",
        });
      }
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        uploadDomainId: values.uploadDomainId || null,
        customSubdomain: values.customSubdomain || null,
      },
    });

    return { success: true, message: "Settings updated successfully" };
  },
  zod$({
    uploadDomainId: z.string().optional(),
    customSubdomain: z.string().optional(),
  }),
);

export default component$(() => {
  const userData = useUserLoader();
  const uploadDomains = useUploadDomainsLoader();
  const updateAction = useUpdateSettingsAction();

  // Set default to first available domain if no domain is selected
  const getDefaultDomainId = () => {
    if (userData.value.user.uploadDomainId) {
      return userData.value.user.uploadDomainId;
    }
    // Find the default domain first, otherwise use the first available domain
    const defaultDomain = uploadDomains.value.find((d) => d.isDefault);
    if (defaultDomain) {
      return defaultDomain.id;
    }
    return uploadDomains.value.length > 0 ? uploadDomains.value[0].id : "";
  };
  const selectedDomainId = useSignal(getDefaultDomainId());
  const customSubdomain = useSignal(userData.value.user.customSubdomain || "");
  const currentThemeDisplay = useSignal<ThemeName>("dark");

  // Update current theme display from DOM
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (typeof document !== "undefined") {
      const updateCurrentTheme = () => {
        const themeVariant = document.documentElement.getAttribute(
          "data-theme-variant",
        ) as ThemeName;
        if (themeVariant) {
          currentThemeDisplay.value = themeVariant;
        }
      };

      // Update immediately
      updateCurrentTheme();

      // Set up observer for changes
      const observer = new MutationObserver(updateCurrentTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme-variant"],
      });

      return () => observer.disconnect();
    }
  });

  const themeOptions = [
    {
      name: "auto" as ThemeName,
      label: "Auto",
      description:
        "Automatically switches between light and dark based on your system preference",
      icon: Sparkles,
      gradient: "from-slate-500 to-slate-600",
      preview: "Follows your system settings like a good kitty~ (=^･ω･^=)",
    },
    {
      name: "dark" as ThemeName,
      label: "Dark",
      description:
        "The classic dark theme - perfect for late night file sharing sessions",
      icon: Moon,
      gradient: "from-slate-800 to-slate-900",
      preview: "Sleek, dark, and mysterious~ Perfect for femboy ninjas! 🥷",
    },
    {
      name: "light" as ThemeName,
      label: "Light",
      description: "Clean and bright theme for daytime productivity",
      icon: Sun,
      gradient: "from-yellow-400 to-orange-500",
      preview: "Bright and cheerful like a sunny day! ☀️",
    },
    {
      name: "pastel" as ThemeName,
      label: "Pastel",
      description: "Soft, dreamy colors that are easy on the eyes",
      icon: Heart,
      gradient: "from-pink-300 to-purple-400",
      preview: "Soft and dreamy like cotton candy clouds~ (´｡• ᵕ •｡`) ♡",
    },
    {
      name: "neon" as ThemeName,
      label: "Neon",
      description: "High-contrast cyberpunk aesthetic with glowing effects",
      icon: Zap,
      gradient: "from-pink-500 to-violet-600",
      preview:
        "Cyberpunk vibes with extra sparkle! Perfect for hacker femboys! ⚡",
    },
    {
      name: "valentine" as ThemeName,
      label: "Valentine",
      description:
        "Romantic pink theme perfect for love letters and cute files",
      icon: Heart,
      gradient: "from-rose-400 to-pink-600",
      preview:
        "Romantic and lovely~ Perfect for sharing files with your crush! 💕",
    },
  ];

  const inputClasses =
    "w-full px-3 sm:px-4 py-2 sm:py-3 glass rounded-full placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-theme-accent-primary/50 transition-all duration-300 text-sm sm:text-base text-theme-primary";

  const getCurrentDomainPreview = () => {
    const selectedDomain = uploadDomains.value.find(
      (d) => d.id === selectedDomainId.value,
    );
    if (!selectedDomain) return "No domain selected";

    const subdomain = customSubdomain.value.trim();
    if (subdomain) {
      return `${subdomain}.${selectedDomain.domain}`;
    }
    return selectedDomain.domain;
  };
  return (
    <div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="mb-6 text-center sm:mb-8">
        <h1 class="text-gradient-cute mb-3 flex flex-wrap items-center justify-center gap-2 text-3xl font-bold sm:text-4xl">
          Settings~
        </h1>
        <p class="text-theme-secondary px-4 text-base sm:text-lg">
          Configure your upload preferences, domain settings, and themes! (◕‿◕)♡
        </p>
      </div>

      {/* Upload Domain Settings */}
      <div class="card-cute mb-6 rounded-3xl p-4 sm:mb-8 sm:p-6">
        <h2 class="text-gradient-cute mb-4 flex items-center text-lg font-bold sm:mb-6 sm:text-xl">
          Upload Domain Settings~ 🌐 <span class="sparkle ml-2">✨</span>
        </h2>

        <Form action={updateAction}>
          <div class="space-y-4 sm:space-y-6">
            <div>
              <label class="text-theme-secondary mb-2 block text-xs font-medium sm:text-sm">
                Upload Domain~ 🌍
              </label>{" "}
              <select
                name="uploadDomainId"
                value={selectedDomainId.value}
                class={inputClasses}
                onChange$={(event) => {
                  selectedDomainId.value = (
                    event.target as HTMLSelectElement
                  ).value;
                }}
              >
                {uploadDomains.value.length === 0 && (
                  <option value="">No domains available</option>
                )}
                {uploadDomains.value.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {`${domain.name} (${domain.domain})${domain.isDefault ? " - Default" : ""}`}
                  </option>
                ))}
              </select>
              <p class="text-theme-muted mt-2 pl-3 text-xs sm:pl-4">
                Choose the base domain for your file uploads~ ✨
              </p>
            </div>

            <div>
              <label class="text-theme-secondary mb-2 block text-xs font-medium sm:text-sm">
                Custom Subdomain (Optional)~ 🎀
              </label>
              <input
                type="text"
                name="customSubdomain"
                value={customSubdomain.value}
                placeholder="files, cdn, cute, etc..."
                class={inputClasses}
                onInput$={(event) => {
                  customSubdomain.value = (
                    event.target as HTMLInputElement
                  ).value;
                }}
              />
              <p class="text-theme-muted mt-2 pl-3 text-xs sm:pl-4">
                Add a custom subdomain to your uploads (e.g., "files" →
                files.domain.com)~ 💕
              </p>
            </div>

            {/* Preview */}
            <div class="glass border-theme-accent-quaternary/20 rounded-2xl border p-4">
              <h3 class="text-theme-accent-quaternary mb-3 flex items-center text-sm font-medium">
                Upload URL Preview~ 👀 <span class="ml-2">✨</span>
              </h3>
              <div class="text-theme-primary bg-theme-tertiary/20 rounded-lg p-3 font-mono text-sm">
                {getCurrentDomainPreview()}/f/cute-filename-123
              </div>
              <p class="text-theme-muted mt-2 text-xs">
                This is how your upload URLs will look~ (◕‿◕)♡
              </p>
            </div>

            <button
              type="submit"
              class="btn-cute text-theme-primary w-full rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base"
            >
              Save Settings~ 💾✨
            </button>
          </div>
        </Form>

        {updateAction.value?.success && (
          <div class="bg-gradient-theme-secondary-tertiary/20 border-theme-accent-secondary/30 glass mt-4 rounded-2xl border p-3 sm:mt-6 sm:p-4">
            <p class="text-theme-accent-secondary flex items-center text-xs sm:text-sm">
              ✅ {updateAction.value.message}~ ✨
            </p>
          </div>
        )}

        {updateAction.value?.failed && (
          <div class="bg-gradient-theme-primary-secondary/20 border-theme-accent-primary/30 glass mt-4 rounded-2xl border p-3 sm:mt-6 sm:p-4">
            <p class="text-theme-accent-primary flex items-center text-xs sm:text-sm">
              ❌ {updateAction.value.message}~ 💔
            </p>
          </div>
        )}
      </div>

      {/* Theme Settings */}
      <div class="card-cute mb-6 rounded-3xl p-4 sm:mb-8 sm:p-6">
        <h2 class="text-gradient-cute mb-4 flex items-center text-lg font-bold sm:mb-6 sm:text-xl">
          Theme Settings~ <Palette class="ml-2 h-5 w-5" />{" "}
          <span class="sparkle ml-2">✨</span>
        </h2>

        {/* Theme Gallery */}
        <div>
          <h3 class="text-theme-primary mb-4 flex items-center gap-2 text-base font-medium sm:text-lg">
            <Eye class="h-4 w-4" />
            Theme Gallery
          </h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {themeOptions.map((option) => {
              const IconComponent = option.icon;
              const isActive = currentThemeDisplay.value === option.name;
              const themeName = option.name;

              return (
                <div
                  key={option.name}
                  class={`glass group cursor-pointer rounded-xl border-2 p-4 transition-all duration-300 ${
                    isActive
                      ? "border-theme-accent-primary/60 bg-gradient-theme-primary-secondary/20"
                      : "border-theme-card-border hover:border-theme-accent-primary/40"
                  }`}
                  onClick$={() => {
                    // Apply theme changes directly like the toggle
                    if (typeof document !== "undefined") {
                      (async () => {
                        const cookieUtils = await import("~/lib/cookie-utils");
                        const themeStore = await import("~/lib/theme-store");

                        // Save to cookie
                        cookieUtils.setThemePreference(themeName);

                        // Apply theme immediately
                        const root = document.documentElement;
                        const themes = themeStore.themes;
                        let effectiveTheme = themeName;
                        if (themeName === "auto") {
                          effectiveTheme = window.matchMedia(
                            "(prefers-color-scheme: dark)",
                          ).matches
                            ? "dark"
                            : "light";
                        }

                        const themeColors =
                          themes[effectiveTheme as keyof typeof themes];
                        Object.entries(themeColors).forEach(([key, value]) => {
                          const cssVarName = `--theme-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
                          root.style.setProperty(cssVarName, value);
                        });
                        root.setAttribute("data-theme", effectiveTheme);
                        root.setAttribute("data-theme-variant", themeName);
                      })();
                    }
                  }}
                >
                  <div class="flex items-start gap-3">
                    <div
                      class={`h-10 w-10 rounded-full bg-gradient-to-r ${option.gradient} flex flex-shrink-0 items-center justify-center`}
                    >
                      <IconComponent class="h-5 w-5 text-white" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="mb-2 flex items-center gap-2">
                        <h4 class="text-theme-primary text-sm font-medium">
                          {option.label}
                        </h4>
                        {isActive && (
                          <span class="bg-gradient-theme-primary-secondary text-theme-primary rounded-full px-2 py-1 text-xs">
                            Active
                          </span>
                        )}
                      </div>
                      <p class="text-theme-secondary mb-2 text-xs">
                        {option.description}
                      </p>
                      <div class="text-theme-muted text-xs italic">
                        {option.preview}
                      </div>
                    </div>
                  </div>
                  {/* Color Swatches */}
                  <div class="mt-3 flex gap-1">
                    <div
                      class="h-4 w-4 rounded-full border border-white/20"
                      style={`background: ${themes[option.name].accentPrimary}`}
                    />
                    <div
                      class="h-4 w-4 rounded-full border border-white/20"
                      style={`background: ${themes[option.name].accentSecondary}`}
                    />
                    <div
                      class="h-4 w-4 rounded-full border border-white/20"
                      style={`background: ${themes[option.name].accentTertiary}`}
                    />
                    <div
                      class="h-4 w-4 rounded-full border border-white/20"
                      style={`background: ${themes[option.name].accentQuaternary}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Theme Tips */}
        <div class="glass border-theme-accent-tertiary/30 mt-6 rounded-xl border p-4">
          <div class="flex items-start gap-3">
            <SettingsIcon class="text-theme-accent-tertiary mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <h4 class="text-theme-accent-tertiary mb-1 text-sm font-medium">
                Theme Tips
              </h4>
              <ul class="text-theme-secondary space-y-1 text-xs">
                <li>
                  • Your theme preference is saved automatically and syncs
                  across devices
                </li>
                <li>
                  • The "Auto" theme respects your system's dark/light mode
                  setting
                </li>
                <li>• Click on any theme to switch to it instantly</li>
                <li>
                  • All themes are designed to be accessible and easy on the
                  eyes
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
