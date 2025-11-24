import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { SearchParamToaster } from "./components/toast/SearchParamToaster";
import { ToastProvider } from "./components/toast/ToastProvider";
import SiteHeader from "./components/SiteHeader";
import YandexAdsProvider from "./components/YandexAdsProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Озёрский вестник — новости города Озерск",
    template: "%s | Озёрский вестник"
  },
  description: "Актуальные новости города Озерск. Городская газета Озёрский вестник — события, статьи, репортажи.",
  keywords: ["Озерск", "новости Озерска", "Озёрский вестник", "городская газета", "ЗАТО Озерск", "Челябинская область"],
  authors: [{ name: "Озёрский вестник" }],
  creator: "Озёрский вестник",
  publisher: "Озёрский вестник",
  metadataBase: new URL('https://xn----dtbhcghdehg5ad2aogq.xn--p1ai'),
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: "Озёрский вестник",
    title: "Озёрский вестник — новости города Озерск",
    description: "Актуальные новости города Озерск. Городская газета Озёрский вестник — события, статьи, репортажи.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Озёрский вестник — новости города Озерск",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@ozerskvestnik",
    title: "Озёрский вестник — новости города Озерск",
    description: "Актуальные новости города Озерск",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="alternate" hrefLang="ru" href="https://xn----dtbhcghdehg5ad2aogq.xn--p1ai" />
        <meta name="yandex-verification" content={process.env.NEXT_PUBLIC_YANDEX_VERIFICATION} />
        <meta name="google-site-verification" content={process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION} />
        <meta property="og:image" content="https://xn----dtbhcghdehg5ad2aogq.xn--p1ai/logo.png" />
        <meta property="vk:image" content="https://xn----dtbhcghdehg5ad2aogq.xn--p1ai/logo.png" />
      </head>
      <body>
        <YandexAdsProvider />
        <ToastProvider>
          <SiteHeader />
          <Suspense fallback={null}>
            <SearchParamToaster />
          </Suspense>
          {children}
          <div id="modal-root" />
        </ToastProvider>
      </body>
    </html>
  );
}