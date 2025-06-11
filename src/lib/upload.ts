import { customAlphabet } from 'nanoid'
import fs from 'fs'
import path from 'path'
import { getEnvConfig } from './env'
import { generateCuteShortCode } from './cute-words'

// Generate short codes for URLs (URL-safe characters)
const generateRandomShortCode = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8)

// Generate deletion keys (longer, more secure)
const generateDeletionKey = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 32)

// Main shortcode generation function that supports both methods
export function generateShortCode(useCuteWords: boolean = false): string {
  if (useCuteWords) {
    return generateCuteShortCode();
  }
  return generateRandomShortCode();
}

// Standalone functions for easier import
export { generateDeletionKey }

// Validate uploaded file
export function validateFile(file: File): { isValid: boolean; error?: string } {
  const config = getEnvConfig();
  const maxSize = config.MAX_FILE_SIZE;
  const allowedTypes = config.ALLOWED_MIME_TYPES;

  // Check file size
  if (file.size > maxSize) {
    return { isValid: false, error: "File too large" };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: "File type not allowed" };
  }

  // Check filename length
  if (file.name.length > 255) {
    return { isValid: false, error: "Filename too long" };
  }

  return { isValid: true };
}

// Save file to storage
export async function saveFile(file: File, filename: string, userId?: string): Promise<string> {
  const config = getEnvConfig();
  const baseUploadDir = config.UPLOAD_DIR;

  // Determine the upload directory based on whether user is authenticated
  let uploadDir: string;
  if (userId) {
    // Create user-specific directory
    uploadDir = path.join(baseUploadDir, userId);
  } else {
    // Anonymous uploads go to 'anonymous' folder
    uploadDir = path.join(baseUploadDir, 'anonymous');
  }

  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, filename);

  // Convert File to Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Write file
  fs.writeFileSync(filePath, buffer);

  return filePath;
}
