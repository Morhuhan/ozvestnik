import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { SearchParamToaster } from "./components/toast/SearchParamToaster";
import { ToastProvider } from "./components/toast/ToastProvider";
import SiteHeader from "./components/SiteHeader";

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
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
