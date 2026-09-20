import type { Metadata } from "next";
import { SessionProvider } from "./auth/session-provider";

export const metadata: Metadata = {
  title: "CV8",
  description: "Generador de CV profesional",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
