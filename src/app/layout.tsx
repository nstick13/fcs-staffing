import type { Metadata } from "next";
import { IBM_Plex_Mono, Merriweather, Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public", subsets: ["latin"] });
const merri = Merriweather({ variable: "--font-merri", subsets: ["latin"], weight: ["400", "700"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "FCS Staffing",
  description: "Foreign Commercial Service staffing map, columns and bid list",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${merri.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
