import type { RequestHandler } from "@builder.io/qwik-city";
import { db } from "~/lib/db";
import { generateShortCode, saveFile, validateFile } from "~/lib/upload";
import { getEnvConfig } from "~/lib/env";
import { nanoid } from "nanoid";

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
  }
    // Validate file
  const validation = validateFile(file);
  if (!validation.isValid) {
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
  let customUploadDomain: string | null = null;
  
  // Get user's preferences if authenticated
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { useCustomWords: true, customUploadDomain: true }
    });
    useCuteWords = user?.useCustomWords || false;
    customUploadDomain = user?.customUploadDomain || null;
  }
    const shortCode = generateShortCode(useCuteWords);
  const deletionKey = nanoid(32);
  const filename = `${shortCode}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    // Save file to storage
  await saveFile(file, filename);
    // Determine the upload domain based on request or user preference
  const requestHost = request.headers.get("host");
  const config = getEnvConfig();
  let uploadDomain = config.BASE_URL;
  
  // Check if request came from a custom domain
  if (requestHost && requestHost !== new URL(config.BASE_URL).host) {
    // Validate this is an allowed custom domain (*.twink.forsale or user's custom domain)
    if (requestHost.endsWith('.twink.forsale') || 
        (customUploadDomain && requestHost === customUploadDomain)) {
      uploadDomain = `https://${requestHost}`;
    }
  } else if (customUploadDomain && !requestHost?.endsWith('.twink.forsale')) {
    // Use user's preferred custom domain if no specific subdomain was used
    uploadDomain = `https://${customUploadDomain}`;
  }
  
  // Create database record
  const upload = await db.upload.create({
    data: {
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      url: `${uploadDomain}/f/${shortCode}`,
      shortCode,
      deletionKey,
      userId
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
  }
    // Return ShareX-compatible response
  const response: any = {
    url: upload.url
  };
    // Add thumbnail URL for images
  if (file.type.startsWith("image/")) {
    response.thumbnail_url = `${uploadDomain}/f/${shortCode}/thumb`;
  }
  
  throw json(201, response);
};
