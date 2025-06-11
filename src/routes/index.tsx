import { component$ } from "@builder.io/qwik";
import { Form, Link, useLocation } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useSession, useSignIn } from "~/routes/plugin@auth";
import { Home, Settings, User, Rocket, Heart, BarChart3, Sparkle, Wrench, FileText } from "lucide-icons-qwik";

export default component$(() => {
  const session = useSession();
  const signIn = useSignIn();
  const loc = useLocation();
  return (
    <>      {/* Hero Section */}
      <div class="relative overflow-hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-24">
          <div class="text-center">
            <h1 class="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              Cute femboy
              <span class="text-gradient-cute block sm:inline">
                {" "}File Sharing
              </span>
            </h1>
            <p class="text-lg sm:text-xl text-pink-200 mb-6 sm:mb-8 max-w-3xl mx-auto px-2">
              Upload and share files with the cutest, most uwu file sharing service ever!
              I made this 80% with ai cuz i could (´｡• ᵕ •｡`) ♡
            </p>
            {session.value ? (
              <div class="flex flex-col sm:flex-row gap-4 justify-center items-center px-4">
                <Link
                  href="/dashboard"
                  class="btn-cute text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Home class="w-5 h-5" />
                  Go to Dashboard
                </Link>
                <Link
                  href="/setup/sharex"
                  class="glass text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Settings class="w-5 h-5" />
                  Setup ShareX
                </Link>
              </div>
            ) : (
              <Form action={signIn} q:slot='end'>
                <input type="hidden" name="providerId" value="discord" />
                <input
                  type="hidden"
                  name="options.redirectTo"
                  value={loc.url.pathname + loc.url.search}
                />                <button class="btn-cute text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold flex items-center justify-center gap-2 w-full sm:w-auto max-w-xs mx-auto">
                  <User class="w-5 h-5" />
                  Get Started
                </button>
              </Form>
            )}
          </div>
        </div>
      </div>      {/* Features Section */}
      <div class="py-12 sm:py-24 relative">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 class="text-2xl sm:text-3xl font-bold text-center text-white mb-4 text-gradient-cute flex items-center justify-center gap-2 flex-wrap">
            Why Choose twink.forsale?
            <Sparkle class="w-6 sm:w-8 h-6 sm:h-8" />
          </h2>
          <p class="text-center text-pink-200 px-4">Because we're the cutest file hosting uwu</p>
          <p class="text-center text-gray-500 mb-8 sm:mb-16 px-4">Do note this is a private/application only site, hit me up on discord @akiradev to ask for access</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div class="card-cute p-8 rounded-3xl">
              <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mb-6">
                <Rocket class="w-8 h-8 text-white" />
              </div>
              <h3 class="text-xl font-semibold text-white mb-3">Femboy Certified ✓</h3>
              <p class="text-pink-200">
                Gay femboy approved file sharing with a focus on simplicity, speed, and maximum cuteness! (◕‿◕)♡
              </p>
            </div>
            <div class="card-cute p-8 rounded-3xl">
              <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full flex items-center justify-center mb-6" style="animation-delay: 0.5s;">
                <Heart class="w-8 h-8 text-white" />
              </div>
              <h3 class="text-xl font-semibold text-white mb-3">Super Secure uwu</h3>
              <p class="text-pink-200">
                Your files are protected with love and care~ (´｡• ᵕ •｡`) ♡
              </p>
            </div>
            <div class="card-cute p-8 rounded-3xl">
              <div class="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center mb-6" style="animation-delay: 1s;">
                <BarChart3 class="w-8 h-8 text-white" />
              </div>
              <h3 class="text-xl font-semibold text-white mb-3">Analytics & Stats</h3>
              <p class="text-pink-200">
                Track views, manage your uploads, and monitor your storage usage with our kawaii dashboard! (=^･ω･^=)
              </p>
            </div>
          </div>
        </div>
      </div>      {/* ShareX Setup Section */}
      <div class="py-12 sm:py-24 relative">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4 text-gradient-cute flex items-center justify-center gap-2 flex-wrap">
            Super Easy ShareX Setup!
            <Wrench class="w-6 sm:w-8 h-6 sm:h-8" />
            <Sparkle class="w-5 sm:w-6 h-5 sm:h-6" />
          </h2>
          <p class="text-lg sm:text-xl text-pink-200 mb-8 sm:mb-12 px-2">
            Set up ShareX in seconds with our automatic configuration generator~ So easy even a catboy could do it! (=^･ω･^=)
          </p>
          <div class="glass rounded-3xl p-4 sm:p-8">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-left">
              <div class="flex items-start space-x-3 sm:space-x-4">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg pulse-soft flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 class="font-semibold text-white mb-2 flex items-center gap-2 text-sm sm:text-base">
                    <User class="w-4 h-4" />
                    Sign In
                  </h3>
                  <p class="text-pink-200 text-xs sm:text-sm">Create your account with Discord~ It's quick and easy!</p>
                </div>
              </div>
              <div class="flex items-start space-x-3 sm:space-x-4">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg pulse-soft flex-shrink-0" style="animation-delay: 0.5s;">
                  2
                </div>
                <div>
                  <h3 class="font-semibold text-white mb-2 flex items-center gap-2 text-sm sm:text-base">
                    <FileText class="w-4 h-4" />
                    Download Config
                  </h3>
                  <p class="text-pink-200 text-xs sm:text-sm">Get your personalized ShareX configuration file</p>
                </div>
              </div>
              <div class="flex items-start space-x-3 sm:space-x-4">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg pulse-soft flex-shrink-0" style="animation-delay: 1s;">
                  3
                </div>
                <div>
                  <h3 class="font-semibold text-white mb-2 flex items-center gap-2 text-sm sm:text-base">
                    <Rocket class="w-4 h-4" />
                    Start Sharing!
                  </h3>
                  <p class="text-pink-200 text-xs sm:text-sm">Upload files instantly with ShareX uwu</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "twink.forsale - Cutest File Sharing Ever! 💕",
  meta: [
    {
      name: "description",
      content: "The most kawaii file sharing service! Upload and share files with adorable ShareX integration. Made with love by femboys for everyone~ uwu",
    },
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1.0",
    },
    {
      property: "og:title",
      content: "twink.forsale - Cutest File Sharing Ever! 💕",
    },
    {
      property: "og:description",
      content: "The most kawaii file sharing service! Upload and share files with adorable ShareX integration uwu",
    },
  ],
};
