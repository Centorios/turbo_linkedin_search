import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "./auth/session-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "CV8",
  description: "Generador de CV profesional",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-canvas font-sans text-text antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
