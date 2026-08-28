import type { Metadata, Viewport } from "next";
import { Lexend_Deca } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const lexend = Lexend_Deca({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CultPartners",
  description: "Portal de parceiros da CULTSEC — gestão de oportunidades comerciais",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CultPartners" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0b10" },
    { media: "(prefers-color-scheme: light)", color: "#f4f5f8" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Tema escuro por padrão; "navy" ou "light" quando o cookie pede.
  const t = (await cookies()).get("theme")?.value;
  const theme = t === "light" || t === "navy" ? t : "dark";
  const themeClass = theme === "dark" ? "dark" : theme === "navy" ? "navy" : "";
  return (
    <html lang="pt-BR" className={`${lexend.variable} ${themeClass} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-text">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
