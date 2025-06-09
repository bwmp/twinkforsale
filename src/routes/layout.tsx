import { component$, Slot, useSignal, useStore, useContextProvider, $ } from "@builder.io/qwik";
import { Form, Link, useLocation } from "@builder.io/qwik-city";
import { useSession, useSignIn, useSignOut } from "./plugin@auth";
import { Home, Upload, Key, Sparkle, Settings, LogOut, User, Menu, X } from "lucide-icons-qwik";
import { ImagePreview } from "~/components/image-preview/image-preview";
import { ImagePreviewContext, type ImagePreviewStore } from "~/lib/image-preview-store";

export default component$(() => {
  const session = useSession();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const location = useLocation();
  const mobileMenuOpen = useSignal(false);
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
  useContextProvider(ImagePreviewContext, contextStore);

  const isCurrentPage = (path: string) => {
    return location.url.pathname === path || location.url.pathname.startsWith(path + '/');
  };
  const closeMobileMenu = $(() => {
    mobileMenuOpen.value = false;
  });
  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-pink-950 relative overflow-hidden">      {/* Navigation */}
      <nav class="relative z-10 border-b border-pink-500/20 glass">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            {/* Logo */}            <div class="flex items-center">
              <Link href="/" class="text-xl sm:text-2xl font-bold text-gradient-cute hover:scale-105 transition-transform duration-300 flex items-center gap-2">
                <div class="heart-gradient sm"></div>
                <span>twink.forsale</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div class="hidden lg:flex items-center space-x-3">
              {session.value ? (
                <>
                  <Link
                    href="/dashboard"
                    class={`px-4 py-2 rounded-full font-medium transition-all duration-300 flex items-center gap-2 ${
                      location.url.pathname === '/dashboard'
                        ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Home class="w-4 h-4" />
                    Dashboard
                  </Link>
                  <Link
                    href="/dashboard/uploads"
                    class={`px-4 py-2 rounded-full font-medium transition-all duration-300 flex items-center gap-2 ${
                      isCurrentPage('/dashboard/uploads')
                        ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Upload class="w-4 h-4" />
                    Uploads
                  </Link>
                  <Link
                    href="/dashboard/api-keys"
                    class={`px-4 py-2 rounded-full font-medium transition-all duration-300 flex items-center gap-2 ${
                      isCurrentPage('/dashboard/api-keys')
                        ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Key class="w-4 h-4" />
                    API Keys
                  </Link>
                  <Link
                    href="/dashboard/embed"
                    class={`px-4 py-2 rounded-full font-medium transition-all duration-300 flex items-center gap-2 ${
                      isCurrentPage('/dashboard/embed')
                        ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Sparkle class="w-4 h-4" />
                    Embed
                  </Link>
                  <Link
                    href="/setup/sharex"
                    class="btn-cute text-white px-5 py-2 rounded-full font-medium flex items-center gap-2"
                  >
                    <Settings class="w-4 h-4" />
                    ShareX Setup
                  </Link>
                  <Form action={signOut} q:slot='end'>
                    <input type="hidden" name="providerId" value="discord" />
                    <input type="hidden" name="options.redirectTo" />
                    <button class="text-slate-300 hover:text-white px-4 py-2 rounded-full hover:bg-white/10 transition-all duration-300 flex items-center gap-2">
                      <LogOut class="w-4 h-4" />
                      Sign Out
                    </button>
                  </Form>
                </>
              ) : (
                <Form action={signIn} q:slot='end'>
                  <input type="hidden" name="providerId" value="discord" />
                  <input type="hidden" name="options.redirectTo" />
                  <button class="btn-cute text-white px-6 py-2 rounded-full font-medium flex items-center gap-2">
                    <User class="w-4 h-4" />
                    Sign In
                  </button>
                </Form>
              )}
            </div>

            {/* Mobile menu button */}
            <div class="lg:hidden flex items-center">
              <button
                onClick$={() => mobileMenuOpen.value = !mobileMenuOpen.value}
                class="text-slate-300 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all duration-300"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen.value ? (
                  <X class="w-6 h-6" />
                ) : (
                  <Menu class="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen.value && (
            <div class="lg:hidden">
              <div class="px-2 pt-2 pb-3 space-y-1 glass rounded-b-2xl border-t border-pink-500/20">
                {session.value ? (
                  <>                    <Link
                      href="/dashboard"
                      onClick$={closeMobileMenu}
                      class={`px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-3 ${
                        location.url.pathname === '/dashboard'
                          ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Home class="w-5 h-5" />
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/uploads"
                      onClick$={closeMobileMenu}
                      class={`px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-3 ${
                        isCurrentPage('/dashboard/uploads')
                          ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Upload class="w-5 h-5" />
                      Uploads
                    </Link>
                    <Link
                      href="/dashboard/api-keys"
                      onClick$={closeMobileMenu}
                      class={`px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-3 ${
                        isCurrentPage('/dashboard/api-keys')
                          ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Key class="w-5 h-5" />
                      API Keys
                    </Link>
                    <Link
                      href="/dashboard/embed"
                      onClick$={closeMobileMenu}
                      class={`px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-3 ${
                        isCurrentPage('/dashboard/embed')
                          ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Sparkle class="w-5 h-5" />
                      Embed
                    </Link>
                    <Link
                      href="/setup/sharex"
                      onClick$={closeMobileMenu}
                      class="px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-3 btn-cute text-white"
                    >
                      <Settings class="w-5 h-5" />
                      ShareX Setup
                    </Link>                    <Form action={signOut} q:slot='end'>
                      <input type="hidden" name="providerId" value="discord" />
                      <input type="hidden" name="options.redirectTo" />
                      <button class="w-full text-left px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-3 text-slate-300 hover:text-white hover:bg-white/10">
                        <LogOut class="w-5 h-5" />
                        Sign Out
                      </button>
                    </Form>
                  </>
                ) : (                  <Form action={signIn} q:slot='end'>
                    <input type="hidden" name="providerId" value="discord" />
                    <input type="hidden" name="options.redirectTo" />
                    <button class="w-full text-left px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-3 btn-cute text-white">
                      <User class="w-5 h-5" />
                      Sign In
                    </button>
                  </Form>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Slot />
      </div>      {/* Global Image Preview Modal */}
      <ImagePreview
        isOpen={contextStore.state.isOpen}
        imageUrl={contextStore.state.imageUrl}
        imageName={contextStore.state.imageName}
        onClose={closePreview}
      />
    </div>
  );
});
