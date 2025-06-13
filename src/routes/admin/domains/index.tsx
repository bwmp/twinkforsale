import { component$, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  Form,
  routeAction$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { Plus, Edit, Trash2, Globe } from "lucide-icons-qwik";
import { db } from "~/lib/db";
export const useAdminCheck = routeLoader$(async (requestEvent) => {
  const session = requestEvent.sharedMap.get("session");

  if (!session?.user?.email) {
    throw requestEvent.redirect(302, "/");
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    throw requestEvent.redirect(302, "/dashboard");
  }

  return { isAdmin: true };
});

export const useUploadDomainsLoader = routeLoader$(async () => {
  const domains = await db.uploadDomain.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { users: true },
      },
    },
  });

  return domains;
});

export const useCreateDomainAction = routeAction$(
  async (values, requestEvent) => {
    const session = requestEvent.sharedMap.get("session");
    if (!session?.user?.email) {
      return requestEvent.fail(401, { message: "Unauthorized" });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return requestEvent.fail(403, { message: "Admin access required" });
    }

    // Check if domain already exists
    const existingDomain = await db.uploadDomain.findUnique({
      where: { domain: values.domain },
    });

    if (existingDomain) {
      return requestEvent.fail(400, { message: "Domain already exists" });
    }

    // If this is set as default, unset other defaults
    if (values.isDefault) {
      await db.uploadDomain.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    await db.uploadDomain.create({
      data: {
        domain: values.domain,
        name: values.name,
        isActive: true,
        isDefault: values.isDefault,
      },
    });

    return { success: true, message: "Upload domain created successfully" };
  },
  zod$({
    domain: z.string().min(1, "Domain is required"),
    name: z.string().min(1, "Name is required"),
    isDefault: z.boolean().default(false),
  }),
);

export const useUpdateDomainAction = routeAction$(
  async (values, requestEvent) => {
    const session = requestEvent.sharedMap.get("session");
    if (!session?.user?.email) {
      return requestEvent.fail(401, { message: "Unauthorized" });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return requestEvent.fail(403, { message: "Admin access required" });
    }

    // If this is set as default, unset other defaults
    if (values.isDefault) {
      await db.uploadDomain.updateMany({
        where: { isDefault: true, id: { not: values.id } },
        data: { isDefault: false },
      });
    }

    await db.uploadDomain.update({
      where: { id: values.id },
      data: {
        domain: values.domain,
        name: values.name,
        isActive: values.isActive,
        isDefault: values.isDefault,
      },
    });

    return { success: true, message: "Upload domain updated successfully" };
  },
  zod$({
    id: z.string(),
    domain: z.string().min(1, "Domain is required"),
    name: z.string().min(1, "Name is required"),
    isActive: z.boolean().default(true),
    isDefault: z.boolean().default(false),
  }),
);

export const useDeleteDomainAction = routeAction$(
  async (values, requestEvent) => {
    const session = requestEvent.sharedMap.get("session");
    if (!session?.user?.email) {
      return requestEvent.fail(401, { message: "Unauthorized" });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return requestEvent.fail(403, { message: "Admin access required" });
    }

    // Check if domain has users
    const domainWithUsers = await db.uploadDomain.findUnique({
      where: { id: values.id },
      include: { _count: { select: { users: true } } },
    });

    if (domainWithUsers?._count.users && domainWithUsers._count.users > 0) {
      return requestEvent.fail(400, {
        message: `Cannot delete domain: ${domainWithUsers._count.users} users are using this domain`,
      });
    }

    await db.uploadDomain.delete({
      where: { id: values.id },
    });

    return { success: true, message: "Upload domain deleted successfully" };
  },
  zod$({
    id: z.string(),
  }),
);

export default component$(() => {
  useAdminCheck();
  const domains = useUploadDomainsLoader();
  const createAction = useCreateDomainAction();
  const updateAction = useUpdateDomainAction();
  const deleteAction = useDeleteDomainAction();

  const showCreateForm = useSignal(false);
  const editingDomain = useSignal<string | null>(null);

  const inputClasses =
    "w-full px-3 sm:px-4 py-2 sm:py-3 glass rounded-full placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-theme-accent-primary/50 transition-all duration-300 text-sm sm:text-base text-theme-primary";

  return (
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="mb-6 text-center sm:mb-8">
        <h1 class="text-gradient-cute mb-3 flex flex-wrap items-center justify-center gap-2 text-3xl font-bold sm:text-4xl">
          Upload Domains Management~
        </h1>
        <p class="text-theme-secondary px-4 text-base sm:text-lg">
          Manage available upload domains for users~ Add cute domains! (◕‿◕)♡
        </p>
      </div>

      {/* Create Domain Button */}
      <div class="mb-6">
        <button
          onClick$={() => {
            showCreateForm.value = !showCreateForm.value;
            editingDomain.value = null;
          }}
          class="btn-cute text-theme-primary flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base"
        >
          <Plus class="h-4 w-4" />
          Add New Domain
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm.value && (
        <div class="card-cute mb-6 rounded-3xl p-4 sm:p-6">
          <h2 class="text-gradient-cute mb-4 flex items-center text-lg font-bold sm:mb-6 sm:text-xl">
            Create New Upload Domain~ 🌐 <span class="sparkle ml-2">✨</span>
          </h2>

          <Form action={createAction}>
            <div class="space-y-4 sm:space-y-6">
              <div>
                <label class="text-theme-secondary mb-2 block text-xs font-medium sm:text-sm">
                  Domain~ 🌍
                </label>
                <input
                  type="text"
                  name="domain"
                  placeholder="example.com"
                  class={inputClasses}
                  required
                />
                <p class="text-theme-muted mt-2 pl-3 text-xs sm:pl-4">
                  The top-level domain (e.g., "twink.forsale", "example.com")~
                  ✨
                </p>
              </div>

              <div>
                <label class="text-theme-secondary mb-2 block text-xs font-medium sm:text-sm">
                  Display Name~ 💝
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Example Domain"
                  class={inputClasses}
                  required
                />
                <p class="text-theme-muted mt-2 pl-3 text-xs sm:pl-4">
                  Friendly name shown to users~ 💕
                </p>
              </div>

              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="isDefault"
                  id="isDefault"
                  class="glass border-theme-accent-primary/30 checked:bg-theme-accent-primary checked:border-theme-accent-primary focus:ring-theme-accent-primary/50 rounded border-2 focus:ring-2"
                />
                <label
                  for="isDefault"
                  class="text-theme-secondary text-xs sm:text-sm"
                >
                  Set as default domain~ ⭐
                </label>
              </div>

              <div class="flex gap-3">
                <button
                  type="submit"
                  class="btn-cute text-theme-primary flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base"
                >
                  Create Domain~ 💾✨
                </button>
                <button
                  type="button"
                  onClick$={() => (showCreateForm.value = false)}
                  class="text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary/20 flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 sm:px-6 sm:py-3 sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Form>

          {createAction.value?.success && (
            <div class="bg-gradient-theme-secondary-tertiary/20 border-theme-accent-secondary/30 glass mt-4 rounded-2xl border p-3 sm:mt-6 sm:p-4">
              <p class="text-theme-accent-secondary flex items-center text-xs sm:text-sm">
                ✅ {createAction.value.message}~ ✨
              </p>
            </div>
          )}

          {createAction.value?.failed && (
            <div class="bg-gradient-theme-primary-secondary/20 border-theme-accent-primary/30 glass mt-4 rounded-2xl border p-3 sm:mt-6 sm:p-4">
              <p class="text-theme-accent-primary flex items-center text-xs sm:text-sm">
                ❌ {createAction.value.message}~ 💔
              </p>
            </div>
          )}
        </div>
      )}

      {/* Domains List */}
      <div class="card-cute rounded-3xl p-4 sm:p-6">
        <h2 class="text-gradient-cute mb-4 flex items-center text-lg font-bold sm:mb-6 sm:text-xl">
          Existing Domains~ 📋 <span class="sparkle ml-2">✨</span>
        </h2>

        <div class="space-y-4">
          {domains.value.map((domain) => (
            <div
              key={domain.id}
              class="glass border-theme-card-border rounded-2xl border p-4"
            >
              {editingDomain.value === domain.id ? (
                <Form action={updateAction}>
                  <input type="hidden" name="id" value={domain.id} />
                  <div class="space-y-4">
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label class="text-theme-secondary mb-2 block text-xs font-medium">
                          Domain
                        </label>
                        <input
                          type="text"
                          name="domain"
                          value={domain.domain}
                          class={inputClasses}
                          required
                        />
                      </div>
                      <div>
                        <label class="text-theme-secondary mb-2 block text-xs font-medium">
                          Display Name
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={domain.name}
                          class={inputClasses}
                          required
                        />
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-4">
                      <div class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="isActive"
                          checked={domain.isActive}
                          class="glass border-theme-accent-primary/30 rounded border-2"
                        />
                        <label class="text-theme-secondary text-xs">
                          Active
                        </label>
                      </div>
                      <div class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="isDefault"
                          checked={domain.isDefault}
                          class="glass border-theme-accent-primary/30 rounded border-2"
                        />
                        <label class="text-theme-secondary text-xs">
                          Default
                        </label>
                      </div>
                    </div>
                    <div class="flex gap-2">
                      <button
                        type="submit"
                        class="btn-cute text-theme-primary rounded-full px-4 py-2 text-xs font-medium"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick$={() => (editingDomain.value = null)}
                        class="text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary/20 rounded-full px-4 py-2 text-xs font-medium transition-all duration-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </Form>
              ) : (
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-3">
                      <Globe class="text-theme-accent-primary h-5 w-5" />
                      <div>
                        <div class="flex items-center gap-2">
                          <h3 class="text-theme-primary font-medium">
                            {domain.name}
                          </h3>
                          {domain.isDefault && (
                            <span class="bg-gradient-theme-accent-secondary text-theme-primary rounded-full px-2 py-1 text-xs">
                              Default
                            </span>
                          )}
                          {!domain.isActive && (
                            <span class="bg-gradient-theme-error text-theme-error rounded-full px-2 py-1 text-xs">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p class="text-theme-secondary text-sm">
                          {domain.domain}
                        </p>
                        <p class="text-theme-muted text-xs">
                          {domain._count.users} users using this domain
                        </p>
                      </div>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      onClick$={() => (editingDomain.value = domain.id)}
                      class="text-theme-accent-secondary hover:bg-theme-tertiary/20 hover:text-theme-accent-primary rounded-full p-2 transition-all duration-300"
                    >
                      <Edit class="h-4 w-4" />
                    </button>
                    <Form action={deleteAction}>
                      <input type="hidden" name="id" value={domain.id} />
                      <button
                        type="submit"
                        class="text-theme-error hover:bg-theme-error/20 hover:text-theme-error rounded-full p-2 transition-all duration-300"
                        onClick$={(e) => {
                          if (
                            !confirm(
                              `Are you sure you want to delete ${domain.name}?`,
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </Form>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {updateAction.value?.success && (
          <div class="bg-gradient-theme-secondary-tertiary/20 border-theme-accent-secondary/30 glass mt-4 rounded-2xl border p-3 sm:mt-6 sm:p-4">
            <p class="text-theme-accent-secondary flex items-center text-xs sm:text-sm">
              ✅ {updateAction.value.message}~ ✨
            </p>
          </div>
        )}

        {(updateAction.value?.failed || deleteAction.value?.failed) && (
          <div class="bg-gradient-theme-primary-secondary/20 border-theme-accent-primary/30 glass mt-4 rounded-2xl border p-3 sm:mt-6 sm:p-4">
            <p class="text-theme-accent-primary flex items-center text-xs sm:text-sm">
              ❌ {updateAction.value?.message || deleteAction.value?.message}~
              💔
            </p>
          </div>
        )}

        {deleteAction.value?.success && (
          <div class="bg-gradient-theme-secondary-tertiary/20 border-theme-accent-secondary/30 glass mt-4 rounded-2xl border p-3 sm:mt-6 sm:p-4">
            <p class="text-theme-accent-secondary flex items-center text-xs sm:text-sm">
              ✅ {deleteAction.value.message}~ ✨
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
