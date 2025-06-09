import { component$ } from "@builder.io/qwik";
import { Form, Link, useLocation } from "@builder.io/qwik-city";
import { useSession, useSignIn, useSignOut } from "~/routes/plugin@auth";
import { Home, Upload, Key, Sparkle, Settings, LogOut, User } from "lucide-icons-qwik";
import { Nav } from '@luminescent/ui-qwik';

export default component$(() => {
  const session = useSession();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const location = useLocation();
  const isCurrentPage = (path: string) => {
    return location.url.pathname === path || location.url.pathname.startsWith(path + '/');
  };
  const isDashboardExact = () => {
    const pathname = location.url.pathname;
    return pathname === '/dashboard' || pathname === '/dashboard/';
  };

  const getNavLinkClasses = (isActive: boolean, isMobile = false) => {
    const baseClasses = `font-medium transition-all duration-300 flex items-center gap-${isMobile ? '3' : '2'} whitespace-nowrap`;
    const sizeClasses = isMobile ? 'px-4 py-3 rounded-xl' : 'px-4 py-2 rounded-full';
    const activeClasses = isActive
      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
      : 'text-slate-300 hover:text-white hover:bg-white/10';

    return `${baseClasses} ${sizeClasses} ${activeClasses}`;
  };

  const buttonClasses = "w-full text-left px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-3";

  return (
    <Nav fixed colorClass="lum-bg-gray-800/40 !border-b !border-pink-500/20">
      {/* Logo/Brand */}
      <Link
        href="/"
        q:slot="start"
        class="text-xl sm:text-2xl font-bold text-gradient-cute hover:scale-105 transition-transform duration-300 flex items-center gap-2"
      >
        <div class="heart-gradient sm"></div>
        <span>twink.forsale</span>
      </Link>
      {/* Desktop Center Navigation */}
      {session.value && (
        <div q:slot="center" class="hidden lg:flex items-center space-x-3">
          <Link
            href="/dashboard"
            class={getNavLinkClasses(isDashboardExact())}
          >
            <Home class="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/uploads"
            class={getNavLinkClasses(isCurrentPage('/dashboard/uploads'))}
          >
            <Upload class="w-4 h-4" />
            Uploads
          </Link>
          <Link
            href="/dashboard/api-keys"
            class={getNavLinkClasses(isCurrentPage('/dashboard/api-keys'))}
          >
            <Key class="w-4 h-4" />
            API Keys
          </Link>
          <Link
            href="/dashboard/embed"
            class={getNavLinkClasses(isCurrentPage('/dashboard/embed'))}
          >
            <Sparkle class="w-4 h-4" />
            Embed
          </Link>
        </div>
      )}

      {/* Desktop End Navigation */}
      <div q:slot="end" class="hidden lg:flex items-center space-x-3">
        {session.value ? (
          <>
            <Link
              href="/setup/sharex"
              class="btn-cute text-white px-5 py-2 rounded-full font-medium flex items-center gap-2"
            >
              <Settings class="w-4 h-4" />
              ShareX Setup
            </Link>
            <Form action={signOut}>
              <input type="hidden" name="providerId" value="discord" />
              <input type="hidden" name="options.redirectTo" />
              <button class="text-slate-300 hover:text-white px-4 py-2 rounded-full hover:bg-white/10 transition-all duration-300 flex items-center gap-2">
                <LogOut class="w-4 h-4" />
                Sign Out
              </button>
            </Form>
          </>
        ) : (
          <Form action={signIn}>
            <input type="hidden" name="providerId" value="discord" />
            <input type="hidden" name="options.redirectTo" />
            <button class="btn-cute text-white px-6 py-2 rounded-full font-medium flex items-center gap-2">
              <User class="w-4 h-4" />
              Sign In
            </button>
          </Form>
        )}
      </div>
      {/* Mobile Navigation Items */}
      {session.value ? (
        <>          <Link
          href="/dashboard"
          q:slot="mobile"
          class={getNavLinkClasses(isDashboardExact(), true)}
        >
          <Home class="w-5 h-5" />
          Dashboard
        </Link>
          <Link
            href="/dashboard/uploads"
            q:slot="mobile"
            class={getNavLinkClasses(isCurrentPage('/dashboard/uploads'), true)}
          >
            <Upload class="w-5 h-5" />
            Uploads
          </Link>
          <Link
            href="/dashboard/api-keys"
            q:slot="mobile"
            class={getNavLinkClasses(isCurrentPage('/dashboard/api-keys'), true)}
          >
            <Key class="w-5 h-5" />
            API Keys
          </Link>
          <Link
            href="/dashboard/embed"
            q:slot="mobile"
            class={getNavLinkClasses(isCurrentPage('/dashboard/embed'), true)}
          >
            <Sparkle class="w-5 h-5" />
            Embed
          </Link>
          <Link
            href="/setup/sharex"
            q:slot="mobile"
            class="px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-3 btn-cute text-white"
          >
            <Settings class="w-5 h-5" />
            ShareX Setup
          </Link>
          <Form action={signOut} q:slot="mobile">
            <input type="hidden" name="providerId" value="discord" />
            <input type="hidden" name="options.redirectTo" />
            <button
              class={`${buttonClasses} text-slate-300 hover:text-white hover:bg-white/10`}
            >
              <LogOut class="w-5 h-5" />
              Sign Out
            </button>
          </Form>
        </>
      ) : (
        <Form action={signIn} q:slot="mobile">
          <input type="hidden" name="providerId" value="discord" />
          <input type="hidden" name="options.redirectTo" />
          <button
            class={`${buttonClasses} btn-cute text-white`}
          >
            <User class="w-5 h-5" />
            Sign In
          </button>
        </Form>
      )}
    </Nav>
  );
});
