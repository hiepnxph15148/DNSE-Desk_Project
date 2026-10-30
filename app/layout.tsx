import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { ensureMarketWsServer } from "@/lib/dnse/market-ws-server";
import "./globals.css";

ensureMarketWsServer();

const sans = Roboto({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "DNSE Desk",
  description: "Bàn giao dịch chứng khoán nối DNSE LightSpeed API",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={sans.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
