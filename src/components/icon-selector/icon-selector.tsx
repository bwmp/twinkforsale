import { component$, useSignal, $, type QRL, useOnDocument, useTask$ } from "@builder.io/qwik";
import { PREDEFINED_ICONS, COMMON_EMOJIS } from "~/lib/bio-icons";
import { BioLinkIcon } from "~/components/bio-link-icon";

export interface IconSelectorProps {
  selectedIcon?: string;
  onIconSelect: QRL<(icon: string) => void>;
  class?: string;
}

export const IconSelector = component$<IconSelectorProps>(
  ({ selectedIcon = "", onIconSelect, class: className = "" }) => {
    const showSelector = useSignal(false);
    const customIconValue = useSignal("");
    const selectorButtonRef = useSignal<HTMLButtonElement>();
    const dropdownPosition = useSignal({ top: 0, left: 0, width: 0 });

    // Calculate dropdown position when it opens
    useTask$(({ track }) => {
      track(() => showSelector.value);
      
      if (showSelector.value && selectorButtonRef.value) {
        const rect = selectorButtonRef.value.getBoundingClientRect();
        dropdownPosition.value = {
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width
        };
      }
    });

    // Close dropdown when clicking outside
    useOnDocument('click', $((event) => {
      if (showSelector.value && !(event.target as Element).closest('.icon-selector')) {
        showSelector.value = false;
      }
    }));

    const handleIconSelect = $(async (icon: string) => {
      await onIconSelect(icon);
      showSelector.value = false;
    });

    const handleCustomIconSubmit = $(async () => {
      if (customIconValue.value.trim()) {
        await onIconSelect(customIconValue.value.trim());
        customIconValue.value = "";
        showSelector.value = false;
      }
    });

    return (
      <div class={`icon-selector relative ${className}`}>        {/* Current Icon Display + Toggle Button */}
        <button
          ref={selectorButtonRef}
          type="button"
          onClick$={() => (showSelector.value = !showSelector.value)}
          class="flex h-10 w-full items-center gap-2 rounded-lg border border-theme-card-border bg-theme-bg-secondary px-3 py-2 text-left transition-all hover:bg-theme-bg-tertiary"
        >
          <div class="flex h-6 w-6 items-center justify-center">
            {selectedIcon ? (
              <BioLinkIcon icon={selectedIcon} size={16} />
            ) : (
              <span class="text-theme-text-muted text-xs">No icon</span>
            )}
          </div>
          <span class="text-theme-text-primary flex-1 text-sm">
            {selectedIcon || "Select icon..."}
          </span>
          <span class="text-theme-text-muted text-xs">
            {showSelector.value ? "▲" : "▼"}
          </span>
        </button>        {/* Icon Selector Dropdown - Rendered with fixed positioning to escape parent constraints */}
        {showSelector.value && (
          <div 
            class="fixed z-[99999] rounded-lg border border-theme-card-border bg-theme-bg-primary p-4 shadow-2xl backdrop-blur-sm"
            style={{
              top: `${dropdownPosition.value.top}px`,
              left: `${dropdownPosition.value.left}px`,
              width: `${dropdownPosition.value.width}px`
            }}
          >
            <div class="space-y-4">
              {/* Predefined Icons */}
              <div>
                <h4 class="text-theme-text-primary mb-2 text-sm font-medium">
                  Platform Icons
                </h4>
                <div class="grid grid-cols-4 gap-2">
                  {Object.keys(PREDEFINED_ICONS).map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick$={() => handleIconSelect(iconName)}
                      class={`hover:bg-theme-accent-primary/10 flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${
                        selectedIcon === iconName
                          ? "border-theme-accent-primary bg-theme-accent-primary/20"
                          : "border-theme-card-border"
                      }`}
                      title={iconName}
                    >
                      <BioLinkIcon icon={iconName} size={16} />
                    </button>
                  ))}
                </div>
              </div>
              {/* Common Emojis */}
              <div>
                <h4 class="text-theme-text-primary mb-2 text-sm font-medium">
                  Emojis
                </h4>
                <div class="grid grid-cols-8 gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick$={() => handleIconSelect(emoji)}
                      class={`hover:bg-theme-accent-primary/10 flex h-8 w-8 items-center justify-center rounded border transition-all ${
                        selectedIcon === emoji
                          ? "border-theme-accent-primary bg-theme-accent-primary/20"
                          : "border-theme-card-border"
                      }`}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              {/* Custom Icon Input */}
              <div>
                <h4 class="text-theme-text-primary mb-2 text-sm font-medium">
                  Custom Icon
                </h4>
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter emoji or icon name..."
                    value={customIconValue.value}
                    onInput$={(e) =>
                      (customIconValue.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                    class="border-theme-card-border bg-theme-bg-secondary flex-1 rounded border px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick$={handleCustomIconSubmit}
                    class="bg-theme-accent-primary hover:bg-theme-accent-primary/80 rounded px-3 py-1 text-sm text-white transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>{" "}
              {/* Clear Selection */}
              <div class="border-theme-card-border border-t pt-3">
                <button
                  type="button"
                  onClick$={() => handleIconSelect("")}
                  class="border-theme-card-border text-theme-text-secondary hover:bg-theme-bg-secondary w-full rounded border py-2 text-sm transition-all"
                >
                  No Icon
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);
