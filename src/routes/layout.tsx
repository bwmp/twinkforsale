import { component$, Slot, useStore, useContextProvider, $ } from "@builder.io/qwik";
import { ImagePreview } from "~/components/image-preview/image-preview";
import { ImagePreviewContext, type ImagePreviewStore } from "~/lib/image-preview-store";
import Navigation from "~/components/navigation/navigation";
import { HeartParticles } from "~/components/heart-particles/heart-particles";

export default component$(() => {
  // Global image preview store
  const imagePreviewStore = useStore({
    state: {
      isOpen: false,
      imageUrl: '',
      imageName: ''
    }
  });

  const openPreview = $((url: string, name?: string) => {
    imagePreviewStore.state.imageUrl = url;
    imagePreviewStore.state.imageName = name || '';
    imagePreviewStore.state.isOpen = true;
    // Prevent body scroll when modal is open
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  });

  const closePreview = $(() => {
    imagePreviewStore.state.isOpen = false;
    imagePreviewStore.state.imageUrl = '';
    imagePreviewStore.state.imageName = '';
    // Restore body scroll
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'unset';
    }
  });

  const contextStore: ImagePreviewStore = {
    state: imagePreviewStore.state,
    openPreview,
    closePreview
  };
  // Provide the context
  useContextProvider(ImagePreviewContext, contextStore);  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-pink-950 relative overflow-hidden">
      {/* Heart particles background - rendered behind everything */}
      <HeartParticles />
      <Navigation />
      <div class="relative z-10 max-w-7xl mx-auto px-4 mt-18 sm:px-6 lg:px-8 py-8">
        <Slot />
      </div>{/* Global Image Preview Modal */}
      <ImagePreview
        isOpen={contextStore.state.isOpen}
        imageUrl={contextStore.state.imageUrl}
        imageName={contextStore.state.imageName}
        onClose={closePreview}
      />
    </div>
  );
});
