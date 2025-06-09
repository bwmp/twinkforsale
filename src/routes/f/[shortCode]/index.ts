import type { RequestHandler } from "@builder.io/qwik-city";
import { db } from "~/lib/db";
import { getServerEnvConfig } from "~/lib/env";
import fs from "fs";
import path from "path";

// Generate Discord embed HTML
function generateDiscordEmbed(upload: any, user: any, baseUrl: string) {
  const embedTitle = user?.embedTitle || "File Upload";
  const embedDescription = user?.embedDescription || "Uploaded via twink.forsale";
  const embedColor = user?.embedColor || "#8B5CF6";
  const embedAuthor = user?.embedAuthor || user?.name;
  const embedFooter = user?.embedFooter || "twink.forsale";
  const showFileInfo = user?.showFileInfo !== false;
  const showUploadDate = user?.showUploadDate !== false;
  
  // Build description with optional file info
  let description = embedDescription;
  if (showFileInfo) {
    const fileSize = (upload.size / 1024 / 1024).toFixed(2);
    description += `\n\n📁 **${upload.originalName}**\n📏 ${fileSize} MB • ${upload.mimeType}`;
  }
  if (showUploadDate) {
    const uploadDate = new Date(upload.createdAt).toLocaleDateString();
    description += `\n📅 Uploaded ${uploadDate}`;
  }
  
  const domain = user?.customDomain || baseUrl.replace(/^https?:\/\//, '');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${embedTitle}</title>
  
  <!-- Discord Embed Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${domain}">
  <meta property="og:title" content="${embedTitle}">
  <meta property="og:description" content="${description.replace(/\n/g, ' ')}">
  <meta property="og:url" content="${upload.url}">
  <meta name="theme-color" content="${embedColor}">
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${embedTitle}">
  <meta name="twitter:description" content="${description.replace(/\n/g, ' ')}">
  
  ${upload.mimeType.startsWith('image/') ? `
  <meta property="og:image" content="${upload.url}">
  <meta property="og:image:type" content="${upload.mimeType}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:image" content="${upload.url}">
  ` : ''}
  
  ${embedAuthor ? `<meta name="author" content="${embedAuthor}">` : ''}
  
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
<body>
  <div class="container">
    <h1>${embedTitle}</h1>
    <div class="file-preview">
      ${upload.mimeType.startsWith('image/') ? 
        `<img src="${upload.url}?direct=true" alt="${upload.originalName}" />` :
        `<div style="font-size: 48px; margin-bottom: 16px;">📄</div>`
      }
      <div class="file-info">
        <strong>${upload.originalName}</strong><br>
        ${(upload.size / 1024 / 1024).toFixed(2)} MB • ${upload.mimeType}<br>
        ${upload.views} views
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
    }
    
    // Check if this is a direct file request
    const isDirect = url.searchParams.get('direct') === 'true';
    
    // Find upload in database with user info for embed settings
    const upload = await db.upload.findUnique({
      where: { shortCode },
      include: { user: true }
    });
    
    if (!upload) {
      status(404);
      return;
    }
    
    // Update view count
    await db.upload.update({
      where: { id: upload.id },
      data: {
        views: { increment: 1 },
        lastViewed: new Date()
      }
    });
      // Get file path
    const config = getServerEnvConfig();
    const uploadDir = config.UPLOAD_DIR;
    const filePath = path.join(uploadDir, upload.filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      status(404);
      return;
    }
    
    // If this is a direct file request or bot/crawler, serve the file directly
    const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
    const isBotOrCrawler = /bot|crawler|spider|crawling|discord|telegram|whatsapp|facebook|twitter|slack/i.test(userAgent);
    
    if (isDirect || (!isBotOrCrawler && upload.mimeType.startsWith('image/'))) {
      // Read and serve file directly
      const fileBuffer = fs.readFileSync(filePath);
        const response = new Response(fileBuffer, {
        headers: {
          "Content-Type": upload.mimeType,
          "Content-Length": upload.size.toString(),
          "Content-Disposition": `inline; filename="${upload.originalName}"`,
          "Cache-Control": "public, max-age=31536000"
        }
      });
      
      send(response);
      return;
    } else {
      // Generate and serve Discord embed HTML
      const config = getServerEnvConfig();
      const baseUrl = config.BASE_URL;
      const embedHtml = generateDiscordEmbed(upload, upload.user, baseUrl);
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
