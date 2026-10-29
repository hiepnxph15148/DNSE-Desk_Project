import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

function env(name: string) {
  const value = process.env[name];
  if (!value) return "";
  return value.replace(/\r/g, "").trim();
}

const googleId = env("GOOGLE_CLIENT_ID");
const googleSecret = env("GOOGLE_CLIENT_SECRET");
const nextAuthSecret = env("NEXTAUTH_SECRET");

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleId,
      clientSecret: googleSecret,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  secret: nextAuthSecret,
};

export function googleAuthConfigured() {
  return Boolean(googleId && googleSecret && nextAuthSecret);
}
