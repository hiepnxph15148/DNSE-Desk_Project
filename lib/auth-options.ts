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
  callbacks: {
    jwt({ token, profile }) {
      if (profile && typeof profile === "object") {
        const google = profile as { name?: string; picture?: string; email?: string };
        if (google.name) token.name = google.name;
        if (google.picture) token.picture = google.picture;
        if (google.email) token.email = google.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.picture === "string") session.user.image = token.picture;
      }
      return session;
    },
  },
};

export function googleAuthConfigured() {
  return Boolean(googleId && googleSecret && nextAuthSecret);
}
