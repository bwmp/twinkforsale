import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const db = new PrismaClient();

interface Upload {
  id: string;
  filename: string;
  userId: string | null;
  user?: {
    id: string;
    name: string | null;
  } | null;
}

async function migrateUploads(): Promise<void> {
  try {
    console.log('Starting upload migration...');
    
    // Get all uploads from database
    const uploads: Upload[] = await db.upload.findMany({
      include: { user: true }
    });

    console.log(`Found ${uploads.length} uploads to migrate`);

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    
    for (const upload of uploads) {
      const oldFilePath = path.join(uploadDir, upload.filename);
      
      // Check if old file exists
      if (!fs.existsSync(oldFilePath)) {
        console.log(`File not found: ${upload.filename}`);
        continue;
      }

      // Determine new directory
      let newDir: string;
      if (upload.userId) {
        newDir = path.join(uploadDir, upload.userId);
      } else {
        newDir = path.join(uploadDir, 'anonymous');
      }

      // Create new directory if it doesn't exist
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
        console.log(`Created directory: ${newDir}`);
      }

      const newFilePath = path.join(newDir, upload.filename);

      // Move file
      try {
        fs.renameSync(oldFilePath, newFilePath);
        console.log(`Moved: ${upload.filename} -> ${upload.userId ? upload.userId : 'anonymous'}/${upload.filename}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to move ${upload.filename}:`, errorMessage);
      }
    }

    console.log('Migration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await db.$disconnect();
  }
}

migrateUploads().catch(console.error);
