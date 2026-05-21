import type { ReactNode } from "react";

export const metadata = {
  title: "Ecommerce Platform",
  description: "Scalable ecommerce platform"
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
