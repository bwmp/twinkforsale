import { db } from './db';
import { getDiskUsage } from './utils';
import { sendCriticalEventNotification } from './discord-notifications';
import os from 'os';

export type EventType = 
  | 'USER_STORAGE_WARNING'
  | 'USER_STORAGE_CRITICAL'
  | 'USER_FILE_LIMIT_WARNING'
  | 'USER_FILE_LIMIT_CRITICAL'
  | 'SYSTEM_STORAGE_WARNING'
  | 'SYSTEM_STORAGE_CRITICAL'
  | 'HIGH_CPU_USAGE'
  | 'HIGH_MEMORY_USAGE'
  | 'SYSTEM_ERROR'
  | 'FAILED_UPLOAD'
  | 'BULK_STORAGE_CLEANUP';

export type EventSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  totalMemory: number;
  freeMemory: number;
  uptime: number;
}

export interface EventMetadata {
  [key: string]: any;
}

/**
 * Get current system metrics
 */
export async function getSystemMetrics(): Promise<SystemMetrics> {
  // Get CPU usage (approximate using loadavg on Unix or process time on Windows)
  const cpus = os.cpus();
  let cpuUsage = 0;
  
  try {
    // Simple CPU usage calculation
    if (os.loadavg) {
      cpuUsage = Math.min(os.loadavg()[0] / cpus.length * 100, 100);
    } else {
      // Fallback for Windows - use a rough estimate
      cpuUsage = Math.random() * 20 + 10; // Placeholder
    }
  } catch {
    cpuUsage = 0;
  }

  // Memory usage
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

  // Disk usage
  const diskInfo = await getDiskUsage('./uploads');
  const diskUsage = diskInfo.usedPercentage;

  return {
    cpuUsage,
    memoryUsage,
    diskUsage,
    totalMemory,
    freeMemory,
    uptime: os.uptime()
  };
}

/**
 * Create a system event
 */
export async function createSystemEvent(
  type: EventType,
  severity: EventSeverity,
  title: string,
  message: string,
  options: {
    userId?: string;
    metadata?: EventMetadata;
    includeMetrics?: boolean;
  } = {}
) {
  const { userId, metadata, includeMetrics = true } = options;
  
  let metrics: Partial<SystemMetrics> = {};
  
  if (includeMetrics) {
    try {
      const systemMetrics = await getSystemMetrics();
      metrics = {
        cpuUsage: systemMetrics.cpuUsage,
        memoryUsage: systemMetrics.memoryUsage,
        diskUsage: systemMetrics.diskUsage
      };
    } catch (error) {
      console.error('Failed to get system metrics:', error);
    }
  }
  const event = await db.systemEvent.create({
    data: {
      type,
      severity,
      title,
      message,
      metadata: metadata ?? undefined,
      userId,
      cpuUsage: metrics.cpuUsage,
      memoryUsage: metrics.memoryUsage,
      diskUsage: metrics.diskUsage
    }
  });

  console.log(`[${severity}] ${type}: ${title}`);
  
  // Send Discord notification for critical and error events
  try {
    // Get user email if userId is provided
    let userEmail: string | undefined;
    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });
      userEmail = user?.email;
    }

    await sendCriticalEventNotification(
      type,
      severity,
      title,
      message,
      {
        metadata,
        userEmail,
        cpuUsage: metrics.cpuUsage,
        memoryUsage: metrics.memoryUsage,
        diskUsage: metrics.diskUsage
      }
    );
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
  }
  
  return event;
}

/**
 * Check user storage usage and create alerts if needed
 */
export async function checkUserStorageAlerts(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { uploads: true }
  });

  if (!user) return;

  // Calculate user's storage limit (use custom limit or default from env)
  const maxStorageLimit = user.maxStorageLimit || (50 * 1024 * 1024 * 1024); // 50GB default
  const storageUsedPercentage = (user.storageUsed / maxStorageLimit) * 100;
  
  // Calculate file count
  const fileCount = user.uploads.length;
  const fileCountPercentage = (fileCount / user.maxUploads) * 100;

  // Check storage usage
  if (storageUsedPercentage >= 95) {
    await createSystemEvent(
      'USER_STORAGE_CRITICAL',
      'CRITICAL',
      'User Storage Critical',
      `User ${user.email} has used ${storageUsedPercentage.toFixed(1)}% of their storage limit`,
      {
        userId,
        metadata: {
          storageUsed: user.storageUsed,
          storageLimit: maxStorageLimit,
          percentage: storageUsedPercentage
        }
      }
    );
  } else if (storageUsedPercentage >= 80) {
    await createSystemEvent(
      'USER_STORAGE_WARNING',
      'WARNING',
      'User Storage Warning',
      `User ${user.email} has used ${storageUsedPercentage.toFixed(1)}% of their storage limit`,
      {
        userId,
        metadata: {
          storageUsed: user.storageUsed,
          storageLimit: maxStorageLimit,
          percentage: storageUsedPercentage
        }
      }
    );
  }

  // Check file count
  if (fileCountPercentage >= 95) {
    await createSystemEvent(
      'USER_FILE_LIMIT_CRITICAL',
      'CRITICAL',
      'User File Limit Critical',
      `User ${user.email} has uploaded ${fileCount}/${user.maxUploads} files (${fileCountPercentage.toFixed(1)}%)`,
      {
        userId,
        metadata: {
          fileCount,
          maxUploads: user.maxUploads,
          percentage: fileCountPercentage
        }
      }
    );
  } else if (fileCountPercentage >= 80) {
    await createSystemEvent(
      'USER_FILE_LIMIT_WARNING',
      'WARNING',
      'User File Limit Warning',
      `User ${user.email} has uploaded ${fileCount}/${user.maxUploads} files (${fileCountPercentage.toFixed(1)}%)`,
      {
        userId,
        metadata: {
          fileCount,
          maxUploads: user.maxUploads,
          percentage: fileCountPercentage
        }
      }
    );
  }
}

/**
 * Check system-wide alerts
 */
export async function checkSystemAlerts() {
  const metrics = await getSystemMetrics();

  // Check disk usage
  if (metrics.diskUsage >= 95) {
    await createSystemEvent(
      'SYSTEM_STORAGE_CRITICAL',
      'CRITICAL',
      'System Storage Critical',
      `Server disk usage is at ${metrics.diskUsage.toFixed(1)}%`,
      {
        metadata: { diskUsage: metrics.diskUsage }
      }
    );
  } else if (metrics.diskUsage >= 85) {
    await createSystemEvent(
      'SYSTEM_STORAGE_WARNING',
      'WARNING',
      'System Storage Warning',
      `Server disk usage is at ${metrics.diskUsage.toFixed(1)}%`,
      {
        metadata: { diskUsage: metrics.diskUsage }
      }
    );
  }

  // Check CPU usage
  if (metrics.cpuUsage >= 90) {
    await createSystemEvent(
      'HIGH_CPU_USAGE',
      'ERROR',
      'High CPU Usage',
      `Server CPU usage is at ${metrics.cpuUsage.toFixed(1)}%`,
      {
        metadata: { cpuUsage: metrics.cpuUsage }
      }
    );
  }

  // Check memory usage
  if (metrics.memoryUsage >= 90) {
    await createSystemEvent(
      'HIGH_MEMORY_USAGE',
      'ERROR',
      'High Memory Usage',
      `Server memory usage is at ${metrics.memoryUsage.toFixed(1)}%`,
      {
        metadata: { 
          memoryUsage: metrics.memoryUsage,
          totalMemory: metrics.totalMemory,
          freeMemory: metrics.freeMemory
        }
      }
    );
  }
}

/**
 * Get recent system events
 */
export async function getRecentSystemEvents(
  limit: number = 50,
  severity?: EventSeverity,
  userId?: string
) {
  return await db.systemEvent.findMany({
    where: {
      ...(severity && { severity }),
      ...(userId && { userId })
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit
  });
}

/**
 * Get system events statistics
 */
export async function getSystemEventsStats(hours: number = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const stats = await db.systemEvent.groupBy({
    by: ['severity'],
    where: {
      createdAt: {
        gte: since
      }
    },
    _count: {
      id: true
    }
  });

  return stats.reduce((acc, stat) => {
    acc[stat.severity as EventSeverity] = stat._count.id;
    return acc;
  }, {} as Record<EventSeverity, number>);
}

/**
 * Clean up old system events (keep last 30 days)
 */
export async function cleanupOldEvents() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const deleted = await db.systemEvent.deleteMany({
    where: {
      createdAt: {
        lt: thirtyDaysAgo
      },
      severity: {
        in: ['INFO', 'WARNING'] // Keep ERROR and CRITICAL events longer
      }
    }
  });

  if (deleted.count > 0) {
    await createSystemEvent(
      'BULK_STORAGE_CLEANUP',
      'INFO',
      'System Events Cleanup',
      `Cleaned up ${deleted.count} old system events`,
      {
        metadata: { deletedCount: deleted.count, olderThan: thirtyDaysAgo }
      }
    );
  }

  return deleted.count;
}

/**
 * Delete a specific system event by ID
 */
export async function deleteSystemEvent(eventId: string): Promise<boolean> {
  try {
    await db.systemEvent.delete({
      where: { id: eventId }
    });
    return true;
  } catch (error) {
    console.error('Failed to delete system event:', error);
    return false;
  }
}

/**
 * Clear all system events (with optional severity filter)
 */
export async function clearAllSystemEvents(severityFilter?: EventSeverity[]): Promise<number> {
  try {
    const deleted = await db.systemEvent.deleteMany({
      where: severityFilter ? {
        severity: {
          in: severityFilter
        }
      } : {}
    });

    if (deleted.count > 0) {
      await createSystemEvent(
        'BULK_STORAGE_CLEANUP',
        'INFO',
        'System Events Cleared',
        `Cleared ${deleted.count} system events${severityFilter ? ` (${severityFilter.join(', ')})` : ''}`,
        {
          metadata: { 
            deletedCount: deleted.count, 
            severityFilter: severityFilter || 'all',
            clearedAt: new Date()
          }
        }
      );
    }

    return deleted.count;
  } catch (error) {
    console.error('Failed to clear system events:', error);
    throw error;
  }
}

/**
 * Clear only non-critical events (INFO and WARNING)
 */
export async function clearNonCriticalEvents(): Promise<number> {
  return await clearAllSystemEvents(['INFO', 'WARNING']);
}

/**
 * Delete multiple system events by IDs
 */
export async function deleteMultipleSystemEvents(eventIds: string[]): Promise<number> {
  try {
    const deleted = await db.systemEvent.deleteMany({
      where: {
        id: {
          in: eventIds
        }
      }
    });

    if (deleted.count > 0) {
      await createSystemEvent(
        'BULK_STORAGE_CLEANUP',
        'INFO',
        'System Events Deleted',
        `Deleted ${deleted.count} selected system events`,
        {
          metadata: { 
            deletedCount: deleted.count,
            eventIds: eventIds,
            deletedAt: new Date()
          }
        }
      );
    }

    return deleted.count;
  } catch (error) {
    console.error('Failed to delete multiple system events:', error);
    throw error;
  }
}

/**
 * Initialize system alert configurations
 */
export async function initializeSystemAlerts() {
  const defaultAlerts = [
    {
      eventType: 'USER_STORAGE_WARNING',
      threshold: 80,
      name: 'User Storage Warning',
      description: 'Alert when user reaches 80% of storage limit',
      notifyUser: true
    },
    {
      eventType: 'USER_STORAGE_CRITICAL',
      threshold: 95,
      name: 'User Storage Critical',
      description: 'Alert when user reaches 95% of storage limit',
      notifyUser: true
    },
    {
      eventType: 'SYSTEM_STORAGE_WARNING',
      threshold: 85,
      name: 'System Storage Warning',
      description: 'Alert when system disk usage reaches 85%'
    },
    {
      eventType: 'SYSTEM_STORAGE_CRITICAL',
      threshold: 95,
      name: 'System Storage Critical',
      description: 'Alert when system disk usage reaches 95%'
    },
    {
      eventType: 'HIGH_CPU_USAGE',
      threshold: 90,
      name: 'High CPU Usage',
      description: 'Alert when CPU usage exceeds 90%'
    },
    {
      eventType: 'HIGH_MEMORY_USAGE',
      threshold: 90,
      name: 'High Memory Usage',
      description: 'Alert when memory usage exceeds 90%'
    }
  ];

  for (const alert of defaultAlerts) {
    await db.systemAlert.upsert({
      where: { id: alert.eventType },
      update: {},
      create: { ...alert, id: alert.eventType }
    });
  }
}

/**
 * Get count of critical/error events in the last 24 hours
 */
export async function getCriticalEventsCount(): Promise<number> {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const count = await db.systemEvent.count({
    where: {
      createdAt: {
        gte: last24h
      },
      severity: {
        in: ['CRITICAL', 'ERROR']
      }
    }
  });

  return count;
}

/**
 * Get unread critical events (for notifications)
 */
export async function getUnreadCriticalEvents() {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return await db.systemEvent.findMany({
    where: {
      createdAt: {
        gte: last24h
      },
      severity: {
        in: ['CRITICAL', 'ERROR']
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  });
}
