export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2)
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function truncateString(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str
}

export function parseStorageSize(value: string): number {
  const trimmed = value.trim().toUpperCase()
  const number = parseFloat(trimmed)

  if (trimmed.endsWith('GB')) {
    return number * 1024 * 1024 * 1024
  } else if (trimmed.endsWith('MB')) {
    return number * 1024 * 1024
  } else if (trimmed.endsWith('KB')) {
    return number * 1024
  } else {
    return number // Assume bytes
  }
}

/**
 * Get the free space available on the drive where the uploads directory is located
 * @param uploadsPath - Path to the uploads directory (defaults to './uploads')
 * @returns Promise that resolves to free space in bytes
 */
export async function getFreeSpace(uploadsPath: string = './uploads'): Promise<number> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const diskusage = await import('diskusage');

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
    const fs = await import('fs');
    const path = await import('path');
    const diskusage = await import('diskusage');

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
    
    return {
      total,
      used,
      free,
      usedPercentage: (used / total) * 100
    };
  }
}