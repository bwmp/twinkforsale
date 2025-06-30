import type { RequestHandler } from "@builder.io/qwik-city";
import { db } from "~/lib/db";
import { generateUniqueShortCode, validateFile } from "~/lib/upload";
import { getEnvConfig } from "~/lib/env";
import { monitorUploadEvent, monitorFailedUpload } from "~/lib/system-monitoring";
import { nanoid } from "nanoid";
import { extractDimensionsFromBuffer } from "~/lib/media-utils";
import { getStorageProvider } from "~/lib/storage-server";

export const onPost: RequestHandler = async ({ request, json }) => {
  // Check for API key authentication
  const authHeader = request.headers.get("Authorization");
  const apiKey = authHeader?.replace("Bearer ", "");

  let userId: string | undefined;
  if (apiKey) {
    // Validate API key and get user
    const keyRecord = await db.apiKey.findUnique({
      where: { key: apiKey, isActive: true },
      include: { user: true }
    });

    if (keyRecord) {
      // Check if user is approved
      if (!keyRecord.user.isApproved) {
        throw json(403, { error: "Account pending approval. Please wait for admin approval before uploading files." });
      }

      userId = keyRecord.userId;
      // Update last used timestamp
      await db.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsed: new Date() }
      });
    }
  }

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    throw json(400, { error: "No file provided" });
  }  // Validate file
  const validation = validateFile(file);
  if (!validation.isValid) {
    // Monitor failed upload
    await monitorFailedUpload(userId || null, validation.error || "File validation failed", {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type
    });
    throw json(400, { error: validation.error });
  }
  // Check user limits if authenticated
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { uploads: true }
    });

    if (user) {
      // Check upload count limit
      if (user.uploads.length >= user.maxUploads) {
        throw json(429, { error: "Upload limit exceeded" });
      }

      // Check file size limit
      if (file.size > user.maxFileSize) {
        throw json(413, { error: "File too large" });
      }
      // Check storage limit (user's custom limit or env default)
      const config = getEnvConfig();
      const userStorageLimit = user.maxStorageLimit || config.BASE_STORAGE_LIMIT;
      const totalStorage = user.storageUsed + file.size;
      if (totalStorage > userStorageLimit) {
        throw json(413, { error: "Storage quota exceeded" });
      }
    }
  } else {
    // Anonymous upload limits
    if (file.size > 5242880) { // 5MB for anonymous
      throw json(413, { error: "File too large for anonymous upload" });
    }
  }  // Generate unique identifiers
  let useCuteWords = false;
  
  // Get user's preferences if authenticated
  let userExpirationDays = null;
  let userMaxViews = null;
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { 
        useCustomWords: true, 
        defaultExpirationDays: true,
        defaultMaxViews: true
      }
    });
    useCuteWords = user?.useCustomWords || false;
    userExpirationDays = user?.defaultExpirationDays;
    userMaxViews = user?.defaultMaxViews;
  }// Check for custom expiration and view limit overrides from form data
  const customExpirationDays = formData.get('expirationDays');
  const customMaxViews = formData.get('maxViews');
  
  // Use custom values if provided, otherwise use user defaults
  const finalExpirationDays = customExpirationDays 
    ? parseInt(customExpirationDays as string) 
    : userExpirationDays;  const finalMaxViews = customMaxViews 
    ? parseInt(customMaxViews as string) 
    : userMaxViews;
  const shortCode = await generateUniqueShortCode(useCuteWords);
  const deletionKey = nanoid(32);
  const filename = `${shortCode}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  // Save file to storage (supports both filesystem and R2)
  const storage = getStorageProvider();
  const uploadResult = await storage.uploadFile(file, filename, userId);

  if (!uploadResult.success) {
    throw json(500, { error: uploadResult.error || "File upload failed" });
  }
  // Extract dimensions for images and videos
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const dimensions = await extractDimensionsFromBuffer(fileBuffer, file.type);

  // Create database record
  const expiresAt = finalExpirationDays 
    ? new Date(Date.now() + finalExpirationDays * 24 * 60 * 60 * 1000)
    : null;

  // Use the storage provider's URL instead of constructing manually
  const upload = await db.upload.create({
    data: {
      filename: uploadResult.key, // Store the storage key
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      url: uploadResult.publicUrl, // Use the public URL from storage
      shortCode,
      deletionKey,
      userId,
      expiresAt,
      maxViews: finalMaxViews,
      width: dimensions?.width,
      height: dimensions?.height
    }
  });
  // Update user storage if authenticated
  if (userId) {
    await db.user.update({
      where: { id: userId },
      data: {
        storageUsed: {
          increment: file.size
        }
      }
    });

    // Monitor upload event for potential alerts
    await monitorUploadEvent(userId, file.size);
  }  // Return ShareX-compatible response
  const response: any = {
    url: upload.url // This will be the R2 public URL or filesystem URL
  };
  
  // Add thumbnail URL for images
  if (file.type.startsWith("image/")) {
    // For R2, this could be a direct image URL or a processed thumbnail
    response.thumbnail_url = upload.url;
  }

  throw json(201, response);
};
