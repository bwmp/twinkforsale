import { QwikAuth$ } from "@auth/qwik";
import GitHub from "@auth/qwik/providers/github";
import Discord from "@auth/qwik/providers/discord";

export const { onRequest, useSession, useSignIn, useSignOut } = QwikAuth$(
  () => ({
    providers: [GitHub, Discord],
    secret: process.env.AUTH_SECRET
  }),
);
