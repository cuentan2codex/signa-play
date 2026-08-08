import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SeñaPlay - Aprende Lenguaje de Señas",
  description: "Aprende lenguaje de señas jugando con tu cámara web. Deletrea palabras haciendo señas con las manos.",
  keywords: ["sign language", "lenguaje de señas", "game", "educación", "ASL"],
  authors: [{ name: "SeñaPlay" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "SeñaPlay - Aprende Lenguaje de Señas",
    description: "Aprende lenguaje de señas jugando con tu cámara web",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
