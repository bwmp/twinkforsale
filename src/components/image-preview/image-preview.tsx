import { component$, $, useSignal, useOnDocument, type QRL } from "@builder.io/qwik";
import { X, Download, ExternalLink } from "lucide-icons-qwik";

export interface ImagePreviewProps {
  isOpen: boolean;
  imageUrl: string;
  imageName?: string;
  onClose: QRL<() => void>;
}

export const ImagePreview = component$<ImagePreviewProps>(({ isOpen, imageUrl, imageName, onClose }) => {
  const imageLoaded = useSignal(false);

  // ESC key handler using useOnDocument
  useOnDocument("keydown", $((event: KeyboardEvent) => {
    if (isOpen && event.key === 'Escape') {
      onClose();
    }
  }));

  const handleBackdropClick = $((event: MouseEvent) => {
    // Only close if clicking the backdrop itself, not the modal content
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal-backdrop')) {
      onClose();
    }
  });

  const handleDownload = $(() => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageName || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  const handleExternalView = $(() => {
    window.open(imageUrl, '_blank');
  });

  if (!isOpen) return null;

  return (
    <div
      class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
      onClick$={handleBackdropClick}
    >      {/* Modal Content */}
      <div
        class="relative max-w-[95vw] max-h-[95vh] glass rounded-3xl border border-pink-300/30 overflow-hidden"
        onClick$={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-pink-300/20 bg-slate-900/50">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
              <div class="text-sm">🖼️</div>
            </div>
            <div>
              <h3 class="text-white font-medium text-sm sm:text-base truncate max-w-[200px] sm:max-w-[300px]">
                {imageName || "Image Preview"}
              </h3>
              <p class="text-pink-200 text-xs">Click outside to close</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div class="flex items-center space-x-2">
            <button
              onClick$={handleDownload}
              class="p-2 text-pink-300 hover:text-white hover:bg-pink-500/20 rounded-full transition-all duration-300"
              title="Download image"
            >
              <Download class="w-4 h-4" />
            </button>
            <button
              onClick$={handleExternalView}
              class="p-2 text-pink-300 hover:text-white hover:bg-pink-500/20 rounded-full transition-all duration-300"
              title="Open in new tab"
            >
              <ExternalLink class="w-4 h-4" />
            </button>
            <button
              onClick$={onClose}
              class="p-2 text-pink-300 hover:text-white hover:bg-red-500/20 rounded-full transition-all duration-300"
              title="Close preview"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div class="relative bg-black/20 flex items-center justify-center min-h-[300px]">
          {/* Loading State */}
          {!imageLoaded.value && (
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="flex flex-col items-center space-y-3">
                <div class="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-pink-200 text-sm">Loading image...</p>
              </div>
            </div>
          )}

          {/* Image */}
          {/* eslint-disable-next-line qwik/jsx-img */}
          <img
            src={imageUrl}
            alt={imageName || "Preview"}
            class={`max-w-full max-h-[70vh] object-contain transition-opacity duration-300 ${imageLoaded.value ? 'opacity-100' : 'opacity-0'
              }`}
            onLoad$={() => {
              imageLoaded.value = true;
            }}
            onError$={() => {
              imageLoaded.value = true;
            }}
          />
        </div>

        {/* Footer */}
        <div class="p-3 border-t border-pink-300/20 bg-slate-900/50">
          <div class="flex items-center justify-center text-center">
            <p class="text-pink-200 text-xs">
              Press <kbd class="px-1 py-0.5 bg-pink-500/20 rounded text-pink-300">ESC</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
