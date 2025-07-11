// Server-only utilities that use Node.js modules
// This file should only be imported on the server side

import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Get disk usage information using Node.js built-in fs.statSync
 * This is a fallback implementation that doesn't require native dependencies
 */
async function getDiskUsageFallback(dirPath: string): Promise<{
  total: number;
  used: number;
  free: number;
  usedPercentage: number;
}> {
  try {
    const absolutePath = path.resolve(dirPath);
    
    // Ensure the directory exists
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }

    // Calculate directory size recursively
    function calculateDirectorySize(dirPath: string): number {
      let size = 0;
      try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            size += calculateDirectorySize(itemPath);
          } else {
            size += stat.size;
          }
        }
      } catch (error) {
        // Ignore permission errors and continue
      }
      return size;
    }

    const used = calculateDirectorySize(absolutePath);
    
    // Estimate available space based on system memory and typical disk ratios
    // This is a rough estimate since we can't get exact disk info without native modules
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    // Estimate total disk space as 10x total memory (typical for cloud instances)
    const estimatedTotal = totalMemory * 10;
    // Estimate free space based on memory usage patterns
    const estimatedFree = Math.max(estimatedTotal - used, freeMemory * 5);
    
    const usedPercentage = estimatedTotal > 0 ? (used / estimatedTotal) * 100 : 0;

    return {
      total: estimatedTotal,
      used,
      free: estimatedFree,
      usedPercentage
    };
  } catch (error) {
    console.error('Error getting disk usage (fallback):', error);
    // Return safe default values
    const total = 500 * 1024 * 1024 * 1024; // 500 GB
    const free = 100 * 1024 * 1024 * 1024;  // 100 GB
    const used = total - free;
    const usedPercentage = total > 0 ? (used / total) * 100 : 0;

    return {
      total,
      used,
      free,
      usedPercentage
    };
  }
}

/**
 * Get disk usage information using diskusage package with fallback
 */
export async function getDiskUsage(uploadsPath: string = './uploads'): Promise<{
  total: number;
  used: number;
  free: number;
  usedPercentage: number;
}> {
  try {
    // Try to use diskusage package first
    const diskusage = await import('diskusage');
    
    const absolutePath = path.resolve(uploadsPath);
    
    // Ensure the directory exists
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }

    // Use diskusage to check disk usage
    const info = await diskusage.default.check(absolutePath);
    const { total, free } = info;
    const used = total - free;
    const usedPercentage = total > 0 ? (used / total) * 100 : 0;

    return {
      total,
      used,
      free,
      usedPercentage
    };
  } catch (error) {
    console.warn('diskusage package not available, using fallback method:', error instanceof Error ? error.message : String(error));
    // Fall back to built-in Node.js implementation
    return getDiskUsageFallback(uploadsPath);
  }
}

/**
 * Get free space available in the uploads directory
 * @param uploadsPath - Path to the uploads directory
 * @returns Free space in bytes
 */
export async function getFreeSpace(uploadsPath: string = './uploads'): Promise<number> {
  try {
    const diskInfo = await getDiskUsage(uploadsPath);
    return diskInfo.free;
  } catch (error) {
    console.error('Error getting free space:', error);
    // Return a safe default value
    return 100 * 1024 * 1024 * 1024; // 100 GB
  }
}

/**
 * Get system metrics including CPU, memory, and disk usage
 * Server-side only function
 */
export async function getSystemMetrics() {
  try {
    // CPU usage calculation
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      const times = cpu.times;
      totalIdle += times.idle;
      totalTick += times.idle + times.user + times.nice + times.sys + times.irq;
    });
    
    const cpuUsage = 100 - (100 * totalIdle / totalTick);

    // Memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;

    // Disk usage
    let diskUsage = 0;
    try {
      const diskInfo = await getDiskUsage('./uploads');
      diskUsage = diskInfo.usedPercentage;
    } catch (error) {
      console.warn('Could not get disk usage:', error);
      diskUsage = 0;
    }

    return {
      cpuUsage,
      memoryUsage,
      diskUsage,
      totalMemory,
      freeMemory,
      usedMemory
    };
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      totalMemory: 0,
      freeMemory: 0,
      usedMemory: 0
    };
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if a file path is safe (prevents path traversal attacks)
 */
export function isSafeFilePath(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath);
  return !normalizedPath.includes('..');
}

/**
 * Get directory size recursively
 */
export async function getDirectorySize(dirPath: string): Promise<number> {
  let size = 0;
  
  try {
    const items = await fs.promises.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = await fs.promises.stat(itemPath);
      
      if (stat.isDirectory()) {
        size += await getDirectorySize(itemPath);
      } else {
        size += stat.size;
      }
    }
  } catch (error) {
    console.error('Error calculating directory size:', error);
  }
  
  return size;
}
