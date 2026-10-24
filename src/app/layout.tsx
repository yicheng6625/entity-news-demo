import type { Metadata } from "next";
import { siteOrigin } from "@/lib/urls";
import "./globals.css";

// metadataBase 讓所有相對的 canonical / OG 網址都解析成絕對網址，避免各頁自行拼接 origin
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "Entity News Platform", template: "%s" },
  description: "A multi-brand, entity-based business news platform demo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
