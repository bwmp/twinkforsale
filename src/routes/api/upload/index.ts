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
      
      // Check storage limit (10GB default)
      const totalStorage = user.storageUsed + file.size;
      if (totalStorage > 10737418240) { // 10GB
        throw json(413, { error: "Storage quota exceeded" });
      }
    }
  } else {
    // Anonymous upload limits
    if (file.size > 5242880) { // 5MB for anonymous
      throw json(413, { error: "File too large for anonymous upload" });
    }
  }
    // Generate unique identifiers
  let useCuteWords = false;
  
  // Get user's shortcode preference if authenticated
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { useCustomWords: true }
    });
    useCuteWords = user?.useCustomWords || false;
  }
  
  const shortCode = generateShortCode(useCuteWords);
  const deletionKey = nanoid(32);
  const filename = `${shortCode}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    // Save file to storage
  await saveFile(file, filename);
    // Create database record
  const config = getEnvConfig();
  const baseUrl = config.BASE_URL;
  const upload = await db.upload.create({
    data: {
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      url: `${baseUrl}/f/${shortCode}`,
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
    response.thumbnail_url = `${baseUrl}/f/${shortCode}/thumb`;
  }
  
  throw json(201, response);
};
