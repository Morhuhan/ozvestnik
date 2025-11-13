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
  title: "Озёрский вестник",
  description: "Городская газета",
  metadataBase: new URL('https://xn----dtbhcghdehg5ad2aogq.xn--p1ai'),
  openGraph: {
    url: 'https://xn----dtbhcghdehg5ad2aogq.xn--p1ai',
    siteName: 'Озёрский вестник',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="canonical" href="https://озерский-вестник.рф" />
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