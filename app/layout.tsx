import type { Metadata, Viewport } from "next";
import PwaRegister from "./PwaRegister";
import AppFooter from "@/components/app-footer";
import "./globals.css";
import "sweetalert2/dist/sweetalert2.min.css";

export const metadata: Metadata = {
  title: "Mercado Alternativo | Pix",
  description: "Gere cobranças Pix e acompanhe os recebimentos do Mercado Alternativo.",
  applicationName: "Mercado Alternativo",
  manifest: "/manifest.json",
  referrer: "no-referrer",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Mercado Alternativo" },
};

export const viewport: Viewport = {
  themeColor: "#111714",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegister />
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
