import { QwikAuth$ } from "@auth/qwik";
import Discord from "@auth/qwik/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "~/lib/db";

export const { onRequest, useSession, useSignIn, useSignOut } = QwikAuth$(
  () => {
    // Simple debug check in development
    if (process.env.NODE_ENV === 'development') {
      if (!process.env.DISCORD_CLIENT_ID) console.warn('Discord Client ID missing');
      if (!process.env.DISCORD_CLIENT_SECRET) console.warn('Discord Client Secret missing');
      if (!process.env.AUTH_SECRET) console.warn('Auth Secret missing');
    }

    return {
      adapter: PrismaAdapter(db),
      providers: [
        Discord({
          clientId: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
        })
      ],
      secret: process.env.AUTH_SECRET,
      trustHost: true,
      callbacks: {
        session: async ({ session, user }) => {
          if (session?.user) {
            session.user.id = user.id;
            // Add approval status and admin role to session
            // No need to worry about BigInt fields since they're now in UserSettings
            const dbUser = await db.user.findUnique({
              where: { id: user.id },
              select: { isApproved: true, isAdmin: true }
            });
            if (dbUser) {
              (session.user as any).isApproved = dbUser.isApproved;
              (session.user as any).isAdmin = dbUser.isAdmin;
            }
          }
          return session;
        },
      },
    };
  },
);
