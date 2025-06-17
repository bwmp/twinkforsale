import { db } from './db';
import { getBioLimits } from './bio-limits';

/**
 * Bio service utilities for managing user bio pages
 */

export interface BioLinkData {
  id?: string;
  title: string;
  url: string;
  icon?: string;
  order: number;
  isActive: boolean;
}

export interface BioPageData {
  username: string;
  displayName?: string;
  description?: string;
  profileImage?: string;
  backgroundImage?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  customCss?: string;
  spotifyTrack?: string;
  isPublic: boolean;
  views: number;
  links: BioLinkData[];
  gradientConfig?: string;
  particleConfig?: string;
  discordUserId?: string;
  showDiscord?: boolean;
  discordConfig?: string;
}

/**
 * Get bio page data by username
 */
export async function getBioPageByUsername(username: string): Promise<BioPageData | null> {
  const user = await db.user.findUnique({
    where: { 
      bioUsername: username,
      bioIsPublic: true,  // Only return public bio pages
      isApproved: true    // Only approved users can have public bios
    },
    include: {
      bioLinks: {
        where: { isActive: true },
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!user || !user.bioUsername) {
    return null;
  }  return {
    username: user.bioUsername,
    displayName: user.bioDisplayName ?? undefined,
    description: user.bioDescription ?? undefined,
    profileImage: user.bioProfileImage ?? undefined,
    backgroundImage: user.bioBackgroundImage ?? undefined,
    backgroundColor: user.bioBackgroundColor || '#8B5CF6',
    textColor: user.bioTextColor || '#FFFFFF',
    accentColor: user.bioAccentColor || '#F59E0B',
    customCss: user.bioCustomCss ?? undefined,
    spotifyTrack: user.bioSpotifyTrack ?? undefined,
    isPublic: user.bioIsPublic,
    views: user.bioViews,
    links: user.bioLinks.map(link => ({
      id: link.id,
      title: link.title,
      url: link.url,
      icon: link.icon ?? undefined,
      order: link.order,
      isActive: link.isActive
    })),
    gradientConfig: user.bioGradientConfig ?? undefined,
    particleConfig: user.bioParticleConfig ?? undefined,
    discordUserId: user.bioDiscordUserId ?? undefined,
    showDiscord: user.bioShowDiscord ?? false,
    discordConfig: user.bioDiscordConfig ?? undefined,
  };
}

/**
 * Track bio page view
 */
export async function trackBioView(
  username: string, 
  ipAddress?: string, 
  userAgent?: string, 
  referer?: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { bioUsername: username },
    select: { id: true }
  });

  if (!user) return;

  // Update view count
  await db.user.update({
    where: { id: user.id },
    data: {
      bioViews: { increment: 1 },
      bioLastViewed: new Date()
    }
  });

  // Log the view for analytics
  await db.bioView.create({
    data: {
      userId: user.id,
      ipAddress,
      userAgent,
      referer,
      viewedAt: new Date()
    }
  });
}

/**
 * Track bio link click
 */
export async function trackLinkClick(linkId: string): Promise<void> {
  await db.bioLink.update({
    where: { id: linkId },
    data: {
      clicks: { increment: 1 }
    }
  });
}

/**
 * Validate bio username availability
 */
export async function isBioUsernameAvailable(username: string, userId?: string): Promise<boolean> {
  const existingUser = await db.user.findUnique({
    where: { bioUsername: username },
    select: { id: true }
  });

  if (!existingUser) return true;
  
  // If checking for current user, it's available
  return existingUser.id === userId;
}

/**
 * Validate username format
 */
export async function validateBioUsername(username: string, userId?: string): Promise<{ isValid: boolean; error?: string }> {
  // Get user limits if userId provided
  let maxLength = 20; // Default
  if (userId) {
    const limits = await getBioLimits(userId);
    maxLength = limits.maxUsernameLength;
  }

  // Check length
  if (username.length < 3) {
    return { isValid: false, error: "Username must be at least 3 characters long" };
  }
  
  if (username.length > maxLength) {
    return { isValid: false, error: `Username must be ${maxLength} characters or less` };
  }

  // Check format - only alphanumeric, underscore, and hyphen
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return { isValid: false, error: "Username can only contain letters, numbers, underscores, and hyphens" };
  }

  // Check for reserved usernames
  const reservedUsernames = [
    'admin', 'api', 'www', 'mail', 'ftp', 'root', 'test', 'demo', 'user',
    'support', 'help', 'about', 'contact', 'dashboard', 'settings', 'profile',
    'login', 'logout', 'register', 'signup', 'signin', 'auth', 'oauth',
    'uploads', 'files', 'cdn', 'static', 'assets', 'public', 'private',
    'terms', 'privacy', 'legal', 'dmca', 'abuse', 'security', 'status'
  ];

  if (reservedUsernames.includes(username.toLowerCase())) {
    return { isValid: false, error: "This username is reserved" };
  }

  return { isValid: true };
}

/**
 * Get bio analytics for a user
 */
export async function getBioAnalytics(userId: string, days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const viewLogs = await db.bioView.findMany({
    where: {
      userId,
      viewedAt: { gte: startDate }
    },
    orderBy: { viewedAt: 'asc' }
  });

  const linkClicks = await db.bioLink.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      url: true,
      clicks: true
    },
    orderBy: { clicks: 'desc' }
  });

  // Group views by date
  const viewsByDate: Record<string, number> = {};
  viewLogs.forEach(log => {
    const date = log.viewedAt.toISOString().split('T')[0];
    viewsByDate[date] = (viewsByDate[date] || 0) + 1;
  });

  return {
    totalViews: viewLogs.length,
    viewsByDate,
    topLinks: linkClicks,
    uniqueIPs: new Set(viewLogs.map(log => log.ipAddress).filter(Boolean)).size
  };
}
