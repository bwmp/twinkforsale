import { component$ } from "@builder.io/qwik";
import { Form, Link, useLocation } from "@builder.io/qwik-city";
import { useSession, useSignIn, useSignOut } from "~/routes/plugin@auth";
import {
  Home,
  Upload,
  Key,
  Sparkle,
  Settings,
  LogOut,
  User,
} from "lucide-icons-qwik";
import { Nav } from "@luminescent/ui-qwik";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";

export default component$(() => {
  const session = useSession();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const location = useLocation();
  const isCurrentPage = (path: string) => {
    return (
      location.url.pathname === path ||
      location.url.pathname.startsWith(path + "/")
    );
  };
  const isDashboardExact = () => {
    const pathname = location.url.pathname;
    return pathname === "/dashboard" || pathname === "/dashboard/";
  };

  const buttonClasses =
    "lum-btn text-sm font-medium lum-bg-transparent";
  const getNavLinkClasses = (isActive: boolean, isMobile = false) => {
    const activeClasses = isActive
      ? "btn-cute shadow-lg"
      : "text-theme-text-secondary hover:text-theme-text-primary";

    return `${buttonClasses} ${activeClasses}`;
  };
  
  return (
    <Nav
      fixed
    >
      {/* Logo/Brand */}
      <Link
        href="/"
        q:slot="start"
        class="lum-btn lum-bg-transparent text-gradient-cute text-xl font-bold"
      >
        <div class="heart-gradient sm"></div>
        <span>twink.forsale</span>
      </Link>
      {/* Desktop Center Navigation */}      {session.value && (
        <div q:slot="center" class="hidden items-center space-x-3 lg:flex">
          <Link href="/dashboard" class={getNavLinkClasses(isDashboardExact())}>
            <Home class="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/uploads"
            class={getNavLinkClasses(isCurrentPage("/dashboard/uploads"))}
          >
            <Upload class="h-4 w-4" />
            Files
          </Link>
          <Link
            href="/dashboard/api-keys"
            class={getNavLinkClasses(isCurrentPage("/dashboard/api-keys"))}
          >
            <Key class="h-4 w-4" />
            API Keys
          </Link>{" "}          <Link
            href="/dashboard/embed"
            class={getNavLinkClasses(isCurrentPage("/dashboard/embed"))}
          >
            <Sparkle class="h-4 w-4" />
            Embed
          </Link>
          <Link
            href="/dashboard/settings"
            class={getNavLinkClasses(isCurrentPage("/dashboard/settings"))}
          >
            <Settings class="h-4 w-4" />
            Settings
          </Link>
          <ThemeToggle variant="compact" class="mr-4" />
        </div>
      )}
      {/* Desktop End Navigation */}
      <div q:slot="end" class="hidden items-center space-x-3 lg:flex">
        {session.value ? (
          <>
            <Link
              href="/setup/sharex"
              class={`${buttonClasses} btn-cute`}
            >
              <Settings class="h-4 w-4" />
              ShareX Setup
            </Link>
            <Form action={signOut}>
              <input type="hidden" name="providerId" value="discord" />
              <input type="hidden" name="options.redirectTo" />
              <button class={`${buttonClasses}`}>
                <LogOut class="h-4 w-4" />
                Sign Out
              </button>
            </Form>
          </>
        ) : (
          <Form action={signIn}>
            <input type="hidden" name="providerId" value="discord" />
            <input type="hidden" name="options.redirectTo" />
            <button class={`${buttonClasses} btn-cute`}>
              <User class="h-4 w-4" />
              Sign In
            </button>
          </Form>
        )}
      </div>
      {/* Mobile Navigation Items */}
      {session.value ? (
        <div q:slot="mobile" class="space-y-2">
          <Link
            href="/dashboard"
            class={getNavLinkClasses(isDashboardExact(), true)}
          >
            <Home class="h-5 w-5" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/uploads"
            class={getNavLinkClasses(isCurrentPage("/dashboard/uploads"), true)}
          >
            <Upload class="h-5 w-5" />
            Files
          </Link>
          <Link
            href="/dashboard/api-keys"
            class={getNavLinkClasses(
              isCurrentPage("/dashboard/api-keys"),
              true,
            )}
          >
            <Key class="h-5 w-5" />
            API Keys
          </Link>{" "}          <Link
            href="/dashboard/embed"
            class={getNavLinkClasses(isCurrentPage("/dashboard/embed"), true)}
          >
            <Sparkle class="h-5 w-5" />
            Embed
          </Link>
          <Link
            href="/dashboard/settings"
            class={getNavLinkClasses(isCurrentPage("/dashboard/settings"), true)}
          >
            <Settings class="h-5 w-5" />
            Settings
          </Link>
          <div class="flex items-center">
            <Link
              href="/setup/sharex"
              class={`${buttonClasses} btn-cute flex-1`}
            >
              <Settings class="h-5 w-5" />
              ShareX Setup
            </Link>
          </div>
          <ThemeToggle variant="dropdown" showLabel={true} />
          <Form action={signOut} q:slot="mobile">
            <input type="hidden" name="providerId" value="discord" />
            <input type="hidden" name="options.redirectTo" />
            <button
              class={`${buttonClasses}`}
            >
              <LogOut class="h-5 w-5" />
              Sign Out
            </button>
          </Form>
        </div>
      ) : (
        <div q:slot="mobile">
          <ThemeToggle variant="dropdown" showLabel={true} />
          <Form action={signIn}>
            <input type="hidden" name="providerId" value="discord" />
            <input type="hidden" name="options.redirectTo" />
            <button class={`${buttonClasses} btn-cute text-white`}>
              <User class="h-5 w-5" />
              Sign In
            </button>
          </Form>
        </div>
      )}
    </Nav>
  );
});
