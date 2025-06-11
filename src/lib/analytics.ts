import { db } from "~/lib/db";

/**
 * Updates daily analytics for the current date
 * This function aggregates view logs and uploads for today
 */
export async function updateDailyAnalytics(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

  try {
    // Count total views for today
    const totalViews = await db.viewLog.count({
      where: {
        viewedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Count unique views for today (unique IP addresses)
    const uniqueViewsResult = await db.viewLog.groupBy({
      by: ['ipAddress'],
      where: {
        viewedAt: {
          gte: today,
          lt: tomorrow
        },
        ipAddress: {
          not: null
        }
      },
      _count: {
        ipAddress: true
      }
    });
    
    const uniqueViews = uniqueViewsResult.length;    // Count uploads for today
    const uploadsCount = await db.upload.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Count users registered today
    const usersRegistered = await db.user.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Upsert daily analytics record
    await db.dailyAnalytics.upsert({
      where: {
        date: today
      },
      update: {
        totalViews,
        uniqueViews,
        uploadsCount,
        usersRegistered,
        updatedAt: new Date()
      },
      create: {
        date: today,
        totalViews,
        uniqueViews,
        uploadsCount,
        usersRegistered
      }
    });

  } catch (error) {
    console.error('Error updating daily analytics:', error);
  }
}

/**
 * Gets real-time analytics data for today
 */
export async function getTodayAnalytics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

  // Count total views for today
  const totalViews = await db.viewLog.count({
    where: {
      viewedAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  // Count unique views for today (unique IP addresses)
  const uniqueViewsResult = await db.viewLog.groupBy({
    by: ['ipAddress'],
    where: {
      viewedAt: {
        gte: today,
        lt: tomorrow
      },
      ipAddress: {
        not: null
      }
    },
    _count: {
      ipAddress: true
    }
  });
  
  const uniqueViews = uniqueViewsResult.length;

  // Count uploads for today
  const uploadsCount = await db.upload.count({
    where: {
      createdAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  // Count users registered today
  const usersRegistered = await db.user.count({
    where: {
      createdAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  return {
    date: today.toISOString().split('T')[0],
    totalViews,
    uniqueViews,
    uploadsCount,
    usersRegistered
  };
}

/**
 * Gets analytics data for the last N days with real-time data for today
 */
export async function getAnalyticsData(days: number = 7) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999); // End of today
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0); // Start of N days ago

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Get stored daily analytics (excluding today for real-time data)
  const analytics = await db.dailyAnalytics.findMany({
    where: {
      date: {
        gte: startDate,
        lt: today // Exclude today to get real-time data
      }
    },
    orderBy: {
      date: 'asc'
    }
  });

  // Get real-time data for today
  const todayAnalytics = await getTodayAnalytics();

  // Fill in missing days with zero data
  const result = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    if (dateStr === todayStr) {
      // Use real-time data for today
      result.push(todayAnalytics);
    } else {
      // Use stored data for previous days
      const existing = analytics.find(a => 
        a.date.toISOString().split('T')[0] === dateStr
      );
      result.push({
        date: dateStr,
        totalViews: existing?.totalViews || 0,
        uniqueViews: existing?.uniqueViews || 0,
        uploadsCount: existing?.uploadsCount || 0,
        usersRegistered: existing?.usersRegistered || 0
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

/**
 * Gets real-time analytics for a specific upload for today
 */
export async function getUploadTodayAnalytics(uploadId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

  const viewLogs = await db.viewLog.findMany({
    where: {
      uploadId,
      viewedAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  const totalViews = viewLogs.length;
  const uniqueIPs = new Set(viewLogs.map(log => log.ipAddress).filter(Boolean));

  return {
    date: today.toISOString().split('T')[0],
    totalViews,
    uniqueViews: uniqueIPs.size
  };
}

/**
 * Gets view analytics for a specific upload over the last N days with real-time data for today
 */
export async function getUploadAnalytics(uploadId: string, days: number = 7) {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Get view logs excluding today for real-time data
  const viewLogs = await db.viewLog.findMany({
    where: {
      uploadId,
      viewedAt: {
        gte: startDate,
        lt: today // Exclude today for real-time data
      }
    },
    orderBy: {
      viewedAt: 'asc'
    }
  });

  // Get real-time data for today
  const todayAnalytics = await getUploadTodayAnalytics(uploadId);

  // Group by date
  const groupedByDate: { [key: string]: { total: number; unique: Set<string> } } = {};
  
  viewLogs.forEach(log => {
    const dateStr = log.viewedAt.toISOString().split('T')[0];
    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = { total: 0, unique: new Set() };
    }
    groupedByDate[dateStr].total += 1;
    if (log.ipAddress) {
      groupedByDate[dateStr].unique.add(log.ipAddress);
    }
  });

  // Fill in missing days and convert to array
  const result = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    if (dateStr === todayStr) {
      // Use real-time data for today
      result.push(todayAnalytics);
    } else {
      // Use stored data for previous days
      const data = groupedByDate[dateStr];
      result.push({
        date: dateStr,
        totalViews: data?.total || 0,
        uniqueViews: data?.unique.size || 0
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return result;
}

/**
 * Gets real-time analytics data for a specific user for today
 */
export async function getUserTodayAnalytics(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

  // Get all user's uploads
  const userUploads = await db.upload.findMany({
    where: { userId },
    select: { id: true }
  });

  const uploadIds = userUploads.map(u => u.id);

  if (uploadIds.length === 0) {
    return {
      date: today.toISOString().split('T')[0],
      totalViews: 0,
      uniqueViews: 0,
      uploadsCount: 0,
      usersRegistered: 0
    };
  }

  // Count total views for today
  const totalViews = await db.viewLog.count({
    where: {
      uploadId: { in: uploadIds },
      viewedAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  // Count unique views for today
  const uniqueViewsResult = await db.viewLog.groupBy({
    by: ['ipAddress'],
    where: {
      uploadId: { in: uploadIds },
      viewedAt: {
        gte: today,
        lt: tomorrow
      },
      ipAddress: {
        not: null
      }
    },
    _count: {
      ipAddress: true
    }
  });
  
  const uniqueViews = uniqueViewsResult.length;

  // Count uploads created by this user today
  const uploadsCount = await db.upload.count({
    where: {
      userId,
      createdAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  return {
    date: today.toISOString().split('T')[0],
    totalViews,
    uniqueViews,
    uploadsCount,
    usersRegistered: 0 // User analytics don't track user registrations
  };
}

/**
 * Gets analytics data for a specific user over the last N days with real-time data for today
 */
export async function getUserAnalytics(userId: string, days: number = 7) {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Get all user's uploads
  const userUploads = await db.upload.findMany({
    where: { userId },
    select: { id: true }
  });

  const uploadIds = userUploads.map(u => u.id);
  if (uploadIds.length === 0) {
    // Return empty data if user has no uploads
    const result = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        totalViews: 0,
        uniqueViews: 0,
        uploadsCount: 0,
        usersRegistered: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return result;
  }

  // Get view logs for all user's uploads (excluding today for real-time data)
  const viewLogs = await db.viewLog.findMany({
    where: {
      uploadId: { in: uploadIds },
      viewedAt: {
        gte: startDate,
        lt: today // Exclude today for real-time data
      }
    },
    orderBy: {
      viewedAt: 'asc'
    }
  });

  // Get uploads created by this user in the time period (excluding today)
  const uploadsInPeriod = await db.upload.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lt: today // Exclude today for real-time data
      }
    },
    select: {
      createdAt: true
    }
  });

  // Get real-time data for today
  const todayAnalytics = await getUserTodayAnalytics(userId);

  // Group by date
  const groupedByDate: { [key: string]: { totalViews: number; uniqueViews: Set<string>; uploadsCount: number } } = {};
  
  // Process view logs
  viewLogs.forEach(log => {
    const dateStr = log.viewedAt.toISOString().split('T')[0];
    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = { totalViews: 0, uniqueViews: new Set(), uploadsCount: 0 };
    }
    groupedByDate[dateStr].totalViews += 1;
    if (log.ipAddress) {
      groupedByDate[dateStr].uniqueViews.add(log.ipAddress);
    }
  });

  // Process uploads
  uploadsInPeriod.forEach(upload => {
    const dateStr = upload.createdAt.toISOString().split('T')[0];
    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = { totalViews: 0, uniqueViews: new Set(), uploadsCount: 0 };
    }
    groupedByDate[dateStr].uploadsCount += 1;
  });

  // Fill in missing days and convert to array
  const result = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    if (dateStr === todayStr) {
      // Use real-time data for today
      result.push(todayAnalytics);
    } else {
      // Use stored data for previous days
      const data = groupedByDate[dateStr];
      result.push({
        date: dateStr,
        totalViews: data?.totalViews || 0,
        uniqueViews: data?.uniqueViews.size || 0,
        uploadsCount: data?.uploadsCount || 0,
        usersRegistered: 0
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}
