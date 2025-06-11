import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { themes, type ThemeName } from "~/lib/theme-store";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";
import {
  Palette,
  Sparkles,
  Sun,
  Moon,
  Heart,
  Zap,
  Eye,
  Settings,
} from "lucide-icons-qwik";

export default component$(() => {
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

  return (
    <>
      <div class="mb-6 text-center sm:mb-8">
        <h1 class="text-gradient-cute mb-3 flex flex-wrap items-center justify-center gap-2 text-3xl font-bold sm:text-4xl">
          Theme Settings
          <Palette class="h-8 w-8" />
        </h1>{" "}
        <p class="text-theme-secondary px-4 text-base sm:text-lg">
          Customize your experience with adorable themes~ (◕‿◕)♡
        </p>
      </div>

      {/* Quick Theme Toggle */}
      <div class="card-cute mb-6 rounded-3xl p-6 sm:mb-8 sm:p-8">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-gradient-cute mb-2 text-lg font-bold sm:text-xl">
              Quick Theme Switch
            </h2>{" "}
            <p class="text-theme-secondary text-sm sm:text-base">
              Currently using:{" "}
              <span class="text-theme-primary font-medium">
                {currentThemeDisplay.value}
              </span>{" "}
              theme
            </p>
          </div>
          <ThemeToggle variant="dropdown" showLabel={true} />
        </div>
      </div>

      {/* Theme Gallery */}
      <div class="card-cute rounded-3xl p-6 sm:p-8">
        <h2 class="text-gradient-cute mb-6 flex items-center gap-2 text-lg font-bold sm:text-xl">
          <Eye class="h-5 w-5" />
          Theme Gallery
        </h2>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          {" "}
          {themeOptions.map((option) => {
            const IconComponent = option.icon;
            const isActive = currentThemeDisplay.value === option.name;
            const themeName = option.name; // Extract to avoid serialization issues

            return (
              <div
                key={option.name}
                class={`glass group cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 ${
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
                <div class="flex items-start gap-4">
                  <div
                    class={`h-12 w-12 rounded-full bg-gradient-to-r ${option.gradient} flex flex-shrink-0 items-center justify-center`}
                  >
                    <IconComponent class="h-6 w-6 text-white" />
                  </div>{" "}
                  <div class="min-w-0 flex-1">
                    {" "}
                    <div class="mb-2 flex items-center gap-2">
                      {" "}
                      <h3 class="text-theme-primary text-lg font-bold">
                        {option.label}
                      </h3>
                      {isActive && (
                        <span class="bg-gradient-theme-primary-secondary text-theme-primary rounded-full px-2 py-1 text-xs">
                          Active
                        </span>
                      )}
                    </div>
                    <p class="text-theme-secondary mb-3 text-sm">
                      {option.description}
                    </p>
                    <div class="text-theme-muted text-xs italic">
                      {option.preview}
                    </div>
                  </div>
                </div>
                {/* Color Swatches */}
                <div class="mt-4 flex gap-2 overflow-hidden">
                  <div
                    class="h-6 w-6 rounded-full border border-white/20"
                    style={`background: ${themes[option.name].accentPrimary}`}
                  />
                  <div
                    class="h-6 w-6 rounded-full border border-white/20"
                    style={`background: ${themes[option.name].accentSecondary}`}
                  />
                  <div
                    class="h-6 w-6 rounded-full border border-white/20"
                    style={`background: ${themes[option.name].accentTertiary}`}
                  />
                  <div
                    class="h-6 w-6 rounded-full border border-white/20"
                    style={`background: ${themes[option.name].accentQuaternary}`}
                  />
                </div>{" "}
                <div class="mt-4 text-center">
                  {" "}
                  <button
                    class={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? "bg-gradient-theme-primary-secondary text-theme-primary"
                        : "hover:bg-theme-tertiary/10 text-theme-muted"
                    }`}
                  >
                    {isActive ? "Currently Active" : "Select Theme"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>{" "}
        <div class="glass border-theme-accent-tertiary/30 mt-8 rounded-xl border p-4">
          <div class="flex items-start gap-3">
            <Settings class="text-theme-accent-tertiary mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <h3 class="text-theme-accent-tertiary mb-1 text-sm font-medium">
                Theme Tips
              </h3>
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
    </>
  );
});

export const head: DocumentHead = {
  title: "Theme Settings - twink.forsale",
  meta: [
    {
      name: "description",
      content:
        "Customize your twink.forsale experience with beautiful themes. Choose from dark, light, pastel, neon, and more!",
    },
  ],
};
