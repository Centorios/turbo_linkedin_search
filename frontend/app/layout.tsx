import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "./auth/session-provider";
import { THEME_INIT_SCRIPT } from "./lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "CV8",
  description: "Generador de CV profesional y búsqueda de empleos en Argentina",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme is set by the inline script before React hydrates.
    <html lang="es-AR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-canvas font-sans text-text antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
