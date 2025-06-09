import { QwikAuth$ } from "@auth/qwik";
import Discord from "@auth/qwik/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "~/lib/db";

export const { onRequest, useSession, useSignIn, useSignOut } = QwikAuth$(
  () => ({
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
  }),
);
