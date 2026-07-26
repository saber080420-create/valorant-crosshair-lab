import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const ogUrl = `${protocol}://${host}/og.png`;
  return {
    title: "准星实验室 2.0｜测出习惯，再决定准星",
    description: "通过五项瞄准检测建立六维能力画像，生成有依据、可复测、可直接导入 VALORANT 的个性化准星方案。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "准星实验室 2.0｜测出习惯，再决定准星",
      description: "五项检测、六维报告、三套方案，生成真正适合你的 VALORANT 准星。",
      type: "website",
      images: [{ url: ogUrl, width: 1200, height: 630, alt: "准星实验室" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "准星实验室 2.0｜测出习惯，再决定准星",
      description: "五项检测、六维报告、三套方案，生成真正适合你的 VALORANT 准星。",
      images: [ogUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
