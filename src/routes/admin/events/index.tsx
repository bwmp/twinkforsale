import { $, component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, type DocumentHead } from "@builder.io/qwik-city";
import {
  AlertTriangle,
  Info,
  RefreshCw,
  Trash,
  Trash2,
  Settings,
  Play,
  CheckCircle,
  OctagonX,
  Clock,
  User
} from "lucide-icons-qwik";
import { formatDate } from "~/lib/utils";
import { useAlert } from "~/lib/use-alert";

export const useAdminCheck = routeLoader$(async (requestEvent) => {
  const { db } = await import("~/lib/db");

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

// Server action to trigger system checks
export const useTriggerSystemCheck = routeAction$(async (data, requestEvent) => {
  const { db } = await import("~/lib/db");
  const { checkSystemAlerts, checkUserStorageAlerts } = await import("~/lib/system-events");
  const { sendAdminActionNotification } = await import("~/lib/discord-notifications");

  const session = requestEvent.sharedMap.get("session");
  if (!session?.user?.email) {
    return { success: false, error: "Unauthorized" };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return { success: false, error: "Admin access required" };
  }

  try {
    // Check system alerts
    await checkSystemAlerts();
    
    // Check all users
    const users = await db.user.findMany({
      select: { id: true }
    });
    
    for (const user of users) {
      await checkUserStorageAlerts(user.id);
    }

    // Send Discord notification for admin action
    await sendAdminActionNotification(
      "Manual System Check",
      session.user.email,
      `Manually triggered system check for ${users.length} users`,
      { userCount: users.length }
    );
    
    return { 
      success: true, 
      message: `System check completed for ${users.length} users` 
    };
  } catch (error) {
    console.error('System check error:', error);
    return { 
      success: false, 
      error: "Failed to run system check" 
    };
  }
});

// Server action to cleanup old events
export const useCleanupEvents = routeAction$(async (data, requestEvent) => {
  const { db } = await import("~/lib/db");
  const { cleanupOldEvents } = await import("~/lib/system-events");
  const { sendAdminActionNotification } = await import("~/lib/discord-notifications");

  const session = requestEvent.sharedMap.get("session");
  if (!session?.user?.email) {
    return { success: false, error: "Unauthorized" };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return { success: false, error: "Admin access required" };
  }

  try {
    const deletedCount = await cleanupOldEvents();

    // Send Discord notification for admin action
    await sendAdminActionNotification(
      "Event Cleanup",
      session.user.email,
      `Cleaned up ${deletedCount} old system events`,
      { deletedCount }
    );

    return { 
      success: true, 
      message: `Cleaned up ${deletedCount} old events` 
    };
  } catch (error) {
    console.error('Cleanup error:', error);
    return { 
      success: false, 
      error: "Failed to cleanup events" 
    };
  }
});

// Server action to delete a specific event
export const useDeleteEvent = routeAction$(async (data, requestEvent) => {
  const { deleteSystemEvent } = await import("~/lib/system-events");
  const { sendAdminActionNotification } = await import("~/lib/discord-notifications");
  const { db } = await import("~/lib/db");

  const session = requestEvent.sharedMap.get("session");
  if (!session?.user?.email) {
    return { success: false, error: "Unauthorized" };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return { success: false, error: "Admin access required" };
  }

  const eventId = data.eventId as string;
  if (!eventId) {
    return { success: false, error: "Event ID is required" };
  }

  try {
    const success = await deleteSystemEvent(eventId);
    if (success) {
      // Send Discord notification for admin action
      await sendAdminActionNotification(
        "Event Deletion",
        session.user.email,
        `Deleted system event with ID: ${eventId}`,
        { eventId }
      );

      return { 
        success: true, 
        message: "Event deleted successfully" 
      };
    } else {
      return { 
        success: false, 
        error: "Failed to delete event" 
      };
    }
  } catch (error) {
    console.error('Delete event error:', error);
    return { 
      success: false, 
      error: "Failed to delete event" 
    };
  }
});

// Server action to clear all events
export const useClearAllEvents = routeAction$(async (data, requestEvent) => {
  const { clearAllSystemEvents } = await import("~/lib/system-events");
  const { sendAdminActionNotification } = await import("~/lib/discord-notifications");
  const { db } = await import("~/lib/db");

  const session = requestEvent.sharedMap.get("session");
  if (!session?.user?.email) {
    return { success: false, error: "Unauthorized" };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return { success: false, error: "Admin access required" };
  }

  try {
    const deletedCount = await clearAllSystemEvents();

    // Send Discord notification for admin action
    await sendAdminActionNotification(
      "Clear All Events",
      session.user.email,
      `Cleared ALL system events (${deletedCount} events deleted)`,
      { deletedCount, severity: "ALL" }
    );

    return { 
      success: true, 
      message: `Cleared ${deletedCount} events` 
    };
  } catch (error) {
    console.error('Clear all events error:', error);
    return { 
      success: false, 
      error: "Failed to clear events" 
    };
  }
});

// Server action to clear non-critical events
export const useClearNonCriticalEvents = routeAction$(async (data, requestEvent) => {
  const { clearNonCriticalEvents } = await import("~/lib/system-events");
  const { sendAdminActionNotification } = await import("~/lib/discord-notifications");
  const { db } = await import("~/lib/db");

  const session = requestEvent.sharedMap.get("session");
  if (!session?.user?.email) {
    return { success: false, error: "Unauthorized" };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return { success: false, error: "Admin access required" };
  }

  try {
    const deletedCount = await clearNonCriticalEvents();

    // Send Discord notification for admin action
    await sendAdminActionNotification(
      "Clear Non-Critical Events",
      session.user.email,
      `Cleared non-critical events (${deletedCount} INFO/WARNING events deleted)`,
      { deletedCount, severity: "INFO, WARNING" }
    );

    return { 
      success: true, 
      message: `Cleared ${deletedCount} non-critical events` 
    };
  } catch (error) {
    console.error('Clear non-critical events error:', error);
    return { 
      success: false, 
      error: "Failed to clear non-critical events" 
    };
  }
});

export const useSystemEventsData = routeLoader$(async () => {
  const { getRecentSystemEvents, getSystemEventsStats } = await import("~/lib/system-events");
  const { getMonitoringStatus } = await import("~/lib/system-monitoring");

  try {
    const recentEvents = await getRecentSystemEvents(100); // Get more events for management
    const eventStats = await getSystemEventsStats(24);
    const monitoringStatus = getMonitoringStatus();

    return {
      events: recentEvents,
      stats: eventStats,
      monitoring: monitoringStatus,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error("System events data error:", error);
    return {
      error: "Failed to load system events data",
      lastUpdated: new Date(),
    };
  }
});

export default component$(() => {
  const eventsData = useSystemEventsData();
  const triggerSystemCheckAction = useTriggerSystemCheck();
  const cleanupEventsAction = useCleanupEvents();
  const deleteEventAction = useDeleteEvent();
  const clearAllEventsAction = useClearAllEvents();
  const clearNonCriticalEventsAction = useClearNonCriticalEvents();
  const { success, error, confirmAsync } = useAlert();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      case 'ERROR': return 'text-orange-600 bg-orange-100';
      case 'WARNING': return 'text-yellow-600 bg-yellow-100';
      case 'INFO': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <OctagonX class="h-4 w-4" />;
      case 'ERROR': return <AlertTriangle class="h-4 w-4" />;
      case 'WARNING': return <AlertTriangle class="h-4 w-4" />;
      case 'INFO': return <Info class="h-4 w-4" />;
      default: return <Info class="h-4 w-4" />;
    }
  };  const triggerSystemCheck = $(async () => {
    const result = await triggerSystemCheckAction.submit();
    if (result.value?.success) {
      await success("System Check Complete", result.value.message || "System check completed successfully");
      window.location.reload();
    } else {
      await error("System Check Failed", result.value?.error || 'Failed to trigger system check');
    }
  });  const cleanupEvents = $(async () => {
    const confirmed = await confirmAsync(
      'Cleanup Old Events',
      'Are you sure you want to cleanup old system events? This will delete events older than 30 days (except CRITICAL and ERROR events).'
    );
    
    if (!confirmed) {
      return;
    }

    const result = await cleanupEventsAction.submit();
    if (result.value?.success) {
      await success("Cleanup Complete", result.value.message || "Old events cleaned up successfully");
      window.location.reload();
    } else {
      await error("Cleanup Failed", result.value?.error || 'Failed to cleanup events');
    }
  });const deleteEvent = $(async (eventId: string) => {
    const confirmed = await confirmAsync('Delete Event', 'Are you sure you want to delete this event? This action cannot be undone.');
    
    if (!confirmed) {
      return;
    }

    const result = await deleteEventAction.submit({ eventId });
    
    if (result.value?.success) {
      await success("Event Deleted", result.value.message || "Event deleted successfully");
      window.location.reload();
    } else {
      await error("Delete Failed", result.value?.error || 'Failed to delete event');
    }
  });

  const clearAllEvents = $(async () => {
    const confirmed = await confirmAsync(
      'Clear All Events',
      'Are you sure you want to clear ALL system events? This action cannot be undone and will delete all events including critical ones.'
    );
    
    if (!confirmed) {
      return;
    }

    const result = await clearAllEventsAction.submit();
    if (result.value?.success) {
      await success("Events Cleared", result.value.message || "All events cleared successfully");
      window.location.reload();
    } else {
      await error("Clear Failed", result.value?.error || 'Failed to clear all events');
    }
  });

  const clearNonCriticalEvents = $(async () => {
    const confirmed = await confirmAsync(
      'Clear Non-Critical Events',
      'Are you sure you want to clear all non-critical events? This will delete all INFO and WARNING events.'
    );
    
    if (!confirmed) {
      return;
    }

    const result = await clearNonCriticalEventsAction.submit();
    if (result.value?.success) {
      await success("Non-Critical Events Cleared", result.value.message || "Non-critical events cleared successfully");
      window.location.reload();
    } else {
      await error("Clear Failed", result.value?.error || 'Failed to clear non-critical events');
    }
  });

  if (eventsData.value.error) {
    return (
      <div class="min-h-screen p-4 sm:p-6">
        <div class="mx-auto max-w-7xl">
          <div class="text-center">
            <AlertTriangle class="mx-auto h-12 w-12 text-red-500" />
            <h1 class="mt-4 text-2xl font-bold text-red-500">
              Failed to Load System Events
            </h1>
            <p class="mt-2 text-gray-600">{eventsData.value.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const data = eventsData.value;

  return (
    <div class="min-h-screen p-4 sm:p-6">
      <div class="mx-auto max-w-7xl">
        {/* Header */}
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h1 class="text-gradient-cute flex items-center gap-3 text-3xl font-bold">
              <Settings class="h-8 w-8" />
              System Events Management
            </h1>
            <p class="text-theme-secondary mt-2">
              Monitor and manage system events and alerts~ 🔔
            </p>
          </div>          <div class="flex items-center gap-2">
            <button
              onClick$={triggerSystemCheck}
              class="btn-primary flex items-center gap-2"
            >
              <Play class="h-4 w-4" />
              Trigger Check
            </button>
            <div class="flex items-center gap-1">
              <button
                onClick$={cleanupEvents}
                class="btn-secondary flex items-center gap-2"
                title="Cleanup old events (30+ days)"
              >
                <Trash class="h-4 w-4" />
                Cleanup Old
              </button>
              <button
                onClick$={clearNonCriticalEvents}
                class="btn-secondary flex items-center gap-2"
                title="Clear INFO and WARNING events"
              >
                <Trash2 class="h-4 w-4" />
                Clear Safe
              </button>              <button
                onClick$={clearAllEvents}
                class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                title="Clear ALL events (including critical)"
              >
                <Trash class="h-4 w-4" />
                Clear All
              </button>
            </div>
            <button
              onClick$={() => window.location.reload()}
              class="btn-secondary flex items-center gap-2"
            >
              <RefreshCw class="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Monitoring Status */}
        <div class="mb-6">
          <div class="card-cute rounded-3xl p-6">
            <h3 class="text-gradient-cute mb-4 flex items-center gap-2 text-lg font-bold">
              <Clock class="h-5 w-5" />
              Monitoring Status
            </h3>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="flex items-center justify-between">
                <span class="text-theme-text-secondary">Monitoring Service</span>
                <div class="flex items-center gap-2">
                  {data.monitoring?.isRunning ? (
                    <>
                      <CheckCircle class="h-4 w-4 text-green-500" />
                      <span class="text-green-600 font-medium">Running</span>
                    </>
                  ) : (
                    <>
                      <OctagonX class="h-4 w-4 text-red-500" />
                      <span class="text-red-600 font-medium">Stopped</span>
                    </>
                  )}
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-theme-text-secondary">Last Updated</span>
                <span class="font-medium">
                  {data.lastUpdated?.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Event Statistics */}
        <div class="mb-6">
          <div class="card-cute rounded-3xl p-6">
            <h3 class="text-gradient-cute mb-4 flex items-center gap-2 text-lg font-bold">
              <Info class="h-5 w-5" />
              Event Statistics (Last 24h)
            </h3>
            <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div class="text-center">
                <div class="text-2xl font-bold text-red-600">
                  {data.stats?.CRITICAL || 0}
                </div>
                <div class="text-sm text-gray-600">Critical</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-orange-600">
                  {data.stats?.ERROR || 0}
                </div>
                <div class="text-sm text-gray-600">Errors</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-yellow-600">
                  {data.stats?.WARNING || 0}
                </div>
                <div class="text-sm text-gray-600">Warnings</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-blue-600">
                  {data.stats?.INFO || 0}
                </div>
                <div class="text-sm text-gray-600">Info</div>
              </div>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div class="mb-6">
          <div class="card-cute rounded-3xl p-6">
            <h3 class="text-gradient-cute mb-4 flex items-center gap-2 text-lg font-bold">
              <AlertTriangle class="h-5 w-5" />
              Recent Events
            </h3>
            {data.events && data.events.length > 0 ? (
              <div class="space-y-3 max-h-96 overflow-y-auto">
                {data.events.map((event, index) => (
                  <div
                    key={index}
                    class="border-theme-card-border border rounded-lg p-4"
                  >                    <div class="flex items-start justify-between">
                      <div class="flex items-start gap-3 flex-1">
                        <span class={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(event.severity)}`}>
                          {getSeverityIcon(event.severity)}
                          {event.severity}
                        </span>
                        <div class="flex-1">
                          <div class="font-medium text-theme-primary">
                            {event.title}
                          </div>
                          <div class="text-theme-text-secondary text-sm mt-1">
                            {event.message}
                          </div>
                          {event.user && (
                            <div class="flex items-center gap-2 mt-2 text-xs text-theme-text-secondary">
                              <User class="h-3 w-3" />
                              {event.user.email}
                            </div>
                          )}
                          {event.metadata && (
                            <details class="mt-2">
                              <summary class="cursor-pointer text-xs text-theme-text-secondary hover:text-theme-primary">
                                View metadata
                              </summary>
                              <pre class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto max-w-full">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                          {(event.cpuUsage || event.memoryUsage || event.diskUsage) && (
                            <div class="grid grid-cols-3 gap-4 mt-2 text-xs">
                              {event.cpuUsage && (
                                <div>
                                  <span class="text-theme-text-secondary">CPU:</span>
                                  <span class="ml-1 font-medium">{event.cpuUsage.toFixed(1)}%</span>
                                </div>
                              )}
                              {event.memoryUsage && (
                                <div>
                                  <span class="text-theme-text-secondary">Memory:</span>
                                  <span class="ml-1 font-medium">{event.memoryUsage.toFixed(1)}%</span>
                                </div>
                              )}
                              {event.diskUsage && (
                                <div>
                                  <span class="text-theme-text-secondary">Disk:</span>
                                  <span class="ml-1 font-medium">{event.diskUsage.toFixed(1)}%</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div class="flex items-start gap-3">
                        <div class="text-theme-text-secondary text-sm text-right">
                          <div>{formatDate(new Date(event.createdAt))}</div>
                          <div class="text-xs">
                            {event.type}
                          </div>
                        </div>
                        <button
                          onClick$={() => deleteEvent(event.id)}
                          class="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                          title="Delete this event"
                        >
                          <Trash2 class="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div class="py-12 text-center">
                <CheckCircle class="mx-auto h-12 w-12 text-green-500" />
                <h3 class="mt-4 text-lg font-medium text-theme-primary">
                  No Events Found
                </h3>
                <p class="text-theme-text-secondary mt-2">
                  System is running smoothly with no events to report! 🎉
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div class="text-center text-sm text-gray-500">
          <p>
            Last updated: {data.lastUpdated?.toLocaleString()}
          </p>
          <p class="mt-1">
            System events are automatically monitored every 5 minutes
          </p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "System Events - Admin - twink.forsale",
  meta: [
    {
      name: "description",
      content: "System events monitoring and management for twink.forsale",
    },
  ],
};
