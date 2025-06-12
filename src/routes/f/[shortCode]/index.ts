import type { RequestHandler } from "@builder.io/qwik-city";
import { db } from "~/lib/db";
import { getEnvConfig } from "~/lib/env";
import { updateDailyAnalytics } from "~/lib/analytics";
import fs from "fs";
import path from "path";

// Generate Discord embed HTML
function generateDiscordEmbed(upload: any, user: any, baseUrl: string, userStats?: { totalFiles: number, totalStorage: number, totalViews: number }) {
  // Helper function to replace placeholders
  const replacePlaceholders = (text: string) => {
    if (!text) return text;

    const fileSize = (upload.size / 1024 / 1024).toFixed(2);
    const uploadDate = new Date(upload.createdAt).toLocaleDateString();
    const storageUsedMB = userStats ? (userStats.totalStorage / 1024 / 1024).toFixed(2) : '0';

    return text
      .replace(/\{filename\}/g, upload.originalName)
      .replace(/\{filesize\}/g, `${fileSize} MB`)
      .replace(/\{filetype\}/g, upload.mimeType)
      .replace(/\{uploaddate\}/g, uploadDate)
      .replace(/\{views\}/g, upload.views.toString())
      .replace(/\{totalfiles\}/g, userStats?.totalFiles.toString() || '0')
      .replace(/\{totalstorage\}/g, `${storageUsedMB} MB`)
      .replace(/\{totalviews\}/g, userStats?.totalViews.toLocaleString() || '0')
      .replace(/\{username\}/g, user?.name || 'Anonymous');
  };

  const embedTitle = replacePlaceholders(user?.embedTitle) || "File Upload";
  const embedDescription = replacePlaceholders(user?.embedDescription) || "Uploaded via twink.forsale";
  const embedColor = user?.embedColor || "#8B5CF6";
  const embedAuthor = user?.embedAuthor || user?.name;
  const embedFooter = user?.embedFooter || "twink.forsale";
  const showFileInfo = user?.showFileInfo !== false;
  const showUploadDate = user?.showUploadDate !== false;
  const showUserStats = user?.showUserStats === true;  // Build description with optional file info
  let description = embedDescription;
  if (showFileInfo) {
    const fileSize = (upload.size / 1024 / 1024).toFixed(2);
    description += `<br><br>📁 <strong>${upload.originalName}</strong><br>📏 ${fileSize} MB • ${upload.mimeType}`;
  }
  if (showUploadDate) {
    const uploadDate = new Date(upload.createdAt).toLocaleDateString();
    description += `<br>📅 Uploaded ${uploadDate}`;
  }
  if (showUserStats && userStats) {
    const storageUsedMB = (userStats.totalStorage / 1024 / 1024).toFixed(2);
    description += `<br><br>👤 <strong>User Stats</strong><br>📊 ${userStats.totalFiles} files uploaded • ${storageUsedMB} MB used<br>👀 ${userStats.totalViews.toLocaleString()} total views`;
  }
  const domain = user?.customDomain || baseUrl.replace(/^https?:\/\//, '');
  // Create plain text version for meta tags (Discord doesn't support HTML or markdown)
  let plainDescription = embedDescription;
  if (showFileInfo) {
    const fileSize = (upload.size / 1024 / 1024).toFixed(2);
    plainDescription += `\n${upload.originalName}\n${fileSize} MB • ${upload.mimeType}`;
  }
  if (showUploadDate) {
    const uploadDate = new Date(upload.createdAt).toLocaleDateString();
    plainDescription += `\nUploaded ${uploadDate}`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${embedTitle}</title>
  <!-- Discord Embed Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${domain}">
  <meta property="og:title" content="${embedTitle}">  <meta property="og:description" content="${plainDescription}">
  <meta property="og:url" content="${upload.url}">
  <meta name="theme-color" content="${embedColor}">
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${embedTitle}">
  <meta name="twitter:description" content="${plainDescription}">  
  ${upload.mimeType === 'image/gif' ? `
  <!-- GIF-specific meta tags for Discord animation support -->
  <meta property="og:image" content="${upload.url}?direct=true">
  <meta property="og:image:type" content="image/gif">
  <meta property="og:image:width" content="498">
  <meta property="og:image:height" content="498">
  <meta name="twitter:image" content="${upload.url}?direct=true">
  <meta name="twitter:image:alt" content="${embedTitle}">
  ` : upload.mimeType.startsWith('image/') ? `
  <!-- Standard image meta tags -->
  <meta property="og:image" content="${upload.url}?direct=true">
  <meta property="og:image:type" content="${upload.mimeType}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:image" content="${upload.url}?direct=true">
  ` : ''}
  ${embedAuthor ? `<meta name="author" content="${embedAuthor}">` : ''}
  
  <!-- oEmbed alternate link for better platform support -->
  <link rel="alternate" href="${baseUrl}/api/oembed?url=${encodeURIComponent(upload.url)}" type="application/json+oembed" title="${embedTitle}">
  
  <!-- Auto-redirect for direct file access -->
  <script>
    // Check if this is a bot/crawler or direct browser access
    const userAgent = navigator.userAgent.toLowerCase();
    const isBotOrCrawler = /bot|crawler|spider|crawling|discord|telegram|whatsapp|facebook|twitter|slack/i.test(userAgent);
    
    if (!isBotOrCrawler) {
      // Redirect browsers to the actual file
      window.location.href = '${upload.url}?direct=true';
    }
  </script>
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #ffffff;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 600px;
      text-align: center;
    }
    .file-preview {
      background: #2a2a2a;
      border-radius: 12px;
      padding: 24px;
      margin: 20px 0;
    }
    .file-info {
      color: #aaa;
      font-size: 14px;
      margin-top: 12px;
    }
    .download-btn {
      display: inline-block;
      background: ${embedColor};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      margin-top: 16px;
      transition: opacity 0.2s;
    }
    .download-btn:hover {
      opacity: 0.8;
    }
    img {
      max-width: 100%;
      max-height: 400px;
      border-radius: 8px;
    }
  </style>
</head>
<body>  <div class="container">
    <h1>${embedTitle}</h1>
    ${description !== embedTitle ? `<p style="color: #ccc; margin-bottom: 20px;">${description}</p>` : ''}
    <div class="file-preview">
      ${upload.mimeType.startsWith('image/') ?
      `<img src="${upload.url}?direct=true" alt="${upload.originalName}" />` :
      `<div style="font-size: 48px; margin-bottom: 16px;">📄</div>`
    }      <div class="file-info">
        <strong>${upload.originalName}</strong><br>
        ${(upload.size / 1024 / 1024).toFixed(2)} MB • ${upload.mimeType}<br>
        ${upload.views} views • ${upload.downloads} downloads
      </div>
    </div>
    <a href="${upload.url}?direct=true" class="download-btn">Download File</a>
    ${embedFooter ? `<p style="color: #666; font-size: 12px; margin-top: 24px;">${embedFooter}</p>` : ''}
  </div>
</body>
</html>`;
}

export const onRequest: RequestHandler = async ({ params, send, status, url, request }) => {
  try {
    const shortCode = params.shortCode;

    if (!shortCode) {
      status(404);
      return;
    }    // Check if this is a direct file request or preview request
    const isDirect = url.searchParams.get('direct') === 'true';
    const isPreview = url.searchParams.get('preview') === 'true';

    // Find upload in database with user info for embed settings
    const upload = await db.upload.findUnique({
      where: { shortCode },
      include: { user: true }
    });

    if (!upload) {
      status(404);
      return;
    }    
    // Update view count only for external views    // Don't count views when accessed from our own dashboard/uploads/admin pages
    const referrer = request.headers.get('referer') || request.headers.get('referrer') || '';

    // Check if this is an internal view from our dashboard/uploads pages
    const isInternalDashboardView = referrer.includes('/dashboard') ||
      referrer.includes('/uploads') ||
      referrer.includes('/admin') ||
      referrer.includes('/api') ||
      referrer.includes('/setup');    // Only increment views if:
    // 1. Not from our internal dashboard/admin pages (excludes image previews, etc.)
    // 2. Not a direct file request (which is usually for downloads)
    // 3. This is not a direct request (which would be a download)
    // 4. Not a preview request (internal dashboard previews)
    // This ensures we only count "real" external views and embeds
    if (!isInternalDashboardView && !isDirect && !isPreview) {
      // Get visitor info for analytics
      const ipAddress = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') ||
        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      // Create view log entry
      await db.viewLog.create({
        data: {
          uploadId: upload.id,
          ipAddress: ipAddress.split(',')[0].trim(), // Take first IP if multiple
          userAgent,
          referer: referrer || null,
        }
      });

      await db.upload.update({
        where: { id: upload.id },
        data: {
          views: { increment: 1 },
          lastViewed: new Date()
        }
      });

      // Update daily analytics (async, don't wait for it)
      updateDailyAnalytics().catch(console.error);
    }
    // Get file path
    const config = getEnvConfig();
    const baseUploadDir = config.UPLOAD_DIR;

    // Determine the correct directory based on whether the upload has a user
    let filePath: string;
    if (upload.userId) {
      filePath = path.join(baseUploadDir, upload.userId, upload.filename);
    } else {
      filePath = path.join(baseUploadDir, 'anonymous', upload.filename);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      status(404);
      return;
    }    // If this is a direct file request, preview request, or browser request, serve the file directly
    // For non-direct requests, serve embed HTML for bots/crawlers, direct file for browsers
    const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
    const isBotOrCrawler = /bot|crawler|spider|crawling|discord|telegram|whatsapp|facebook|twitter|slack/i.test(userAgent);

    if (isDirect || isPreview || (!isBotOrCrawler)) {
      // Track download ONLY when it's an explicit direct request (?direct=true)
      // or when it's a non-bot request that's not from our internal pages
      // and not a preview request
      if (isDirect && !isInternalDashboardView && !isPreview) {
        // Get visitor info for download analytics
        const ipAddress = request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          request.headers.get('cf-connecting-ip') ||
          'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Create download log entry
        await db.downloadLog.create({
          data: {
            uploadId: upload.id,
            ipAddress: ipAddress.split(',')[0].trim(), // Take first IP if multiple
            userAgent,
            referer: referrer || null,
          }
        });

        // Update download count
        await db.upload.update({
          where: { id: upload.id },
          data: {
            downloads: { increment: 1 },
            lastDownloaded: new Date()
          }
        });

        // Update daily analytics (async, don't wait for it)
        updateDailyAnalytics().catch(console.error);
      }

      // Read and serve file directly
      const fileBuffer = fs.readFileSync(filePath);

      // Special headers for GIFs to ensure proper animation support
      const headers: Record<string, string> = {
        "Content-Type": upload.mimeType,
        "Content-Length": upload.size.toString(),
        "Content-Disposition": `inline; filename="${upload.originalName}"`,
        "Cache-Control": "public, max-age=31536000"
      };// Additional headers for GIFs to ensure proper playback
      if (upload.mimeType === 'image/gif') {
        headers["X-Content-Type-Options"] = "nosniff";
        headers["Accept-Ranges"] = "bytes";
        // Ensure proper caching for Discord
        headers["Cache-Control"] = "public, max-age=31536000, immutable";
      }

      const response = new Response(fileBuffer, { headers });

      send(response);
      return;
    } else {
      // Generate and serve Discord embed HTML
      const config = getEnvConfig();
      const baseUrl = config.BASE_URL;

      // Fetch user statistics if the user wants to show them
      let userStats = undefined;
      if (upload.user?.showUserStats) {
        const [totalFiles, totalStorageResult, totalViewsResult] = await Promise.all([
          db.upload.count({ where: { userId: upload.userId } }),
          db.upload.aggregate({
            where: { userId: upload.userId },
            _sum: { size: true }
          }),
          db.upload.aggregate({
            where: { userId: upload.userId },
            _sum: { views: true }
          })
        ]);

        userStats = {
          totalFiles,
          totalStorage: totalStorageResult._sum.size || 0,
          totalViews: totalViewsResult._sum.views || 0
        };
      }

      const embedHtml = generateDiscordEmbed(upload, upload.user, baseUrl, userStats);
      const response = new Response(embedHtml, {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300" // 5 minutes cache for embeds
        }
      });

      send(response);
      return;
    }

  } catch (error) {
    console.error("File serve error:", error);
    status(404);
  }
};
