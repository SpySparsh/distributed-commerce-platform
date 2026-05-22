import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "./app-shell";

export const metadata = {
  title: "MyShop Ecommerce",
  description: "Production-grade ecommerce storefront"
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
