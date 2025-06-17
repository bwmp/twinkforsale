import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { type ThemeName, themes } from "~/lib/theme-store";
import { Moon, Sun, Sparkles, Heart, Zap } from "lucide-icons-qwik";
import { setThemePreference } from "~/lib/cookie-utils";
import { SelectMenuRaw } from "@luminescent/ui-qwik";

export interface ThemeToggleProps {
  variant?: "compact" | "full" | "dropdown";
  showLabel?: boolean;
  class?: string;
}

export const ThemeToggle = component$<ThemeToggleProps>(
  ({ variant = "compact", showLabel = false, class: className = "" }) => {
    const currentTheme = useSignal<ThemeName>("dark");

    // Update current theme from DOM
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
      if (typeof document !== "undefined") {
        const updateCurrentTheme = () => {
          const themeVariant = document.documentElement.getAttribute(
            "data-theme-variant",
          ) as ThemeName;
          if (themeVariant) {
            currentTheme.value = themeVariant;
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

    const themeOptions: Array<{
      value: ThemeName;
      label: string;
      icon: any;
      description: string;
      gradient: string;
    }> = [
      {
        value: "auto",
        label: "Auto",
        icon: Sparkles,
        description: "Follows system preference",
        gradient: "from-slate-500 to-slate-600",
      },
      {
        value: "dark",
        label: "Dark",
        icon: Moon,
        description: "Classic dark theme",
        gradient: "from-slate-800 to-slate-900",
      },
      {
        value: "light",
        label: "Light",
        icon: Sun,
        description: "Clean light theme",
        gradient: "from-yellow-400 to-orange-500",
      },
      {
        value: "pastel",
        label: "Pastel",
        icon: Heart,
        description: "Soft pastel vibes",
        gradient: "from-pink-300 to-purple-400",
      },
      {
        value: "neon",
        label: "Neon",
        icon: Zap,
        description: "Cyberpunk aesthetic",
        gradient: "from-pink-500 to-violet-600",
      },
      {
        value: "valentine",
        label: "Valentine",
        icon: Heart,
        description: "Romantic pink theme",
        gradient: "from-rose-400 to-pink-600",
      },
    ];

    const currentThemeOption =
      themeOptions.find((option) => option.value === currentTheme.value) ||
      themeOptions[0];    const handleThemeChange = $((newTheme: ThemeName) => {
      // Apply theme changes directly without reload
      if (typeof document !== "undefined") {
        (async () => {
          // Save to cookie
          setThemePreference(newTheme);

          // Apply theme immediately
          const root = document.documentElement;
          let effectiveTheme = newTheme;
          if (newTheme === "auto") {
            effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)")
              .matches
              ? "dark"
              : "light";
          }

          const themeColors = themes[effectiveTheme as keyof typeof themes];
          Object.entries(themeColors).forEach(([key, value]) => {
            const cssVarName = `--theme-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
            root.style.setProperty(cssVarName, value);
          });

          root.setAttribute("data-theme", effectiveTheme);
          root.setAttribute("data-theme-variant", newTheme);
        })();
      }
    });
    const handleCycleTheme = $(() => {
      // Get current theme from DOM attribute instead of context to avoid serialization
      const currentTheme =
        (document.documentElement.getAttribute(
          "data-theme-variant",
        ) as ThemeName) || "dark";
      const mainThemes: ThemeName[] = ["auto", "dark", "light"];
      const currentIndex = mainThemes.indexOf(currentTheme);
      const nextTheme = mainThemes[(currentIndex + 1) % mainThemes.length];
      handleThemeChange(nextTheme);
    });
    // Compact variant - just the current theme icon
    if (variant === "compact") {
      const IconComponent = currentThemeOption.icon;
      return (
        <button
          onClick$={handleCycleTheme}
          class={`lum-btn group rounded-full p-2 transition-all duration-300 hover:bg-white/20 ${className}`}
          title={`Current theme: ${currentThemeOption.label}. Click to cycle themes.`}
        >
          <IconComponent class="text-theme-accent-primary group-hover:text-theme-text-primary h-5 w-5 transition-colors" />
          {showLabel && (
            <span class="text-theme-accent-primary group-hover:text-theme-text-primary ml-2 text-sm">
              {currentThemeOption.label}
            </span>
          )}
        </button>
      );
    }
    // Dropdown variant - full theme selector
    return (
      <div class={`relative z-50 ${className}`}>
        <SelectMenuRaw id="theme-toggle" customDropdown
        onChange$={(e, el) => handleThemeChange(el.value as ThemeName)}
        values={themeOptions.map((option) => {
          const IconComponent = option.icon;
          const isActive = currentTheme.value === option.value;

          return {
            name: (
              <div class="flex items-center gap-2 text-left">
                <div
                  class={`h-8 w-8 rounded-full bg-gradient-to-r ${option.gradient} flex items-center justify-center`}
                >
                  <IconComponent class="h-4 w-4 text-white" />
                </div>
                <div class="flex-1">
                  <div class="text-theme-text-primary text-sm font-medium">
                    {option.label}
                    {isActive && (
                      <span class="text-theme-accent-primary ml-2 text-xs">✓</span>
                    )}
                  </div>
                  <div class="text-theme-text-muted text-xs">
                    {option.description}
                  </div>
                </div>
              </div>
            ),
            value: option.value,
          };
        })}
        value={currentTheme.value}>
          <div q:slot="dropdown" class="flex items-center gap-2">
            <currentThemeOption.icon class="text-theme-accent-primary group-hover:text-theme-text-primary h-5 w-5 transition-colors" />
            {(variant === "full" || showLabel) && (
              <span class="text-theme-accent-primary group-hover:text-theme-text-primary text-sm">
                {currentThemeOption.label}
              </span>
            )}
          </div>
        </SelectMenuRaw>
      </div>
    );
  },
);
