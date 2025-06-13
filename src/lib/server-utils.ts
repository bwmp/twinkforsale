// Server-only utilities that use Node.js modules
// This file should only be imported on the server side

import fs from 'fs';
import path from 'path';
import os from 'os';
import diskusage from 'diskusage';

/**
 * Get free space available in the uploads directory
 * @param uploadsPath - Path to the uploads directory
 * @returns Free space in bytes
 */
export async function getFreeSpace(uploadsPath: string = './uploads'): Promise<number> {
  try {
    // Resolve the absolute path
    const absolutePath = path.resolve(uploadsPath);
    
    // Ensure the directory exists
    if (!fs.existsSync(absolutePath)) {
      // Create the directory if it doesn't exist
      fs.mkdirSync(absolutePath, { recursive: true });
    }

    // Use diskusage to get disk space information
    const info = await diskusage.check(absolutePath);
    return info.free;
    
  } catch (error) {
    console.error('Error getting free space:', error);
    // Return a safe default value
    return 100 * 1024 * 1024 * 1024; // 100 GB
  }
}

/**
 * Get disk usage information for the uploads directory
 * @param uploadsPath - Path to the uploads directory
 * @returns Object containing total, used, and free space in bytes
 */
export async function getDiskUsage(uploadsPath: string = './uploads'): Promise<{
  total: number;
  used: number;
  free: number;
  usedPercentage: number;
}> {
  try {
    const absolutePath = path.resolve(uploadsPath);
    
    // Ensure the directory exists
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }

    // Use diskusage to get disk space information
    const info = await diskusage.check(absolutePath);
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
    console.error('Error getting disk usage:', error);
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
 * Get system metrics including CPU, memory, and disk usage
 * Server-side only function
 */
export async function getSystemMetrics() {  try {
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
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = (usedMem / totalMem) * 100;
    
    // Disk usage
    const diskInfo = await getDiskUsage('./uploads');
    
    return {
      cpuUsage,
      memoryUsage,
      diskUsage: diskInfo.usedPercentage,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      timestamp: Date.now()
    };
  }
}
