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
// Server-only functions moved to server-utils.ts to avoid client bundling issues
// These functions are re-exported here for backwards compatibility but should not be used on client side
export { getFreeSpace, getDiskUsage } from './server-utils';