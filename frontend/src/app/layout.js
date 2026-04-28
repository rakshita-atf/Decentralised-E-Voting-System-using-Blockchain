import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Decentralised E-Voting System | Blockchain-Powered Elections",
  description:
    "A highly secure, transparent, and immutable voting platform powered by Polygon. Features Soulbound NFT voter identity, commit-reveal voting, and DAO governance.",
  keywords: [
    "blockchain",
    "e-voting",
    "decentralised",
    "polygon",
    "smart contracts",
    "soulbound NFT",
    "commit-reveal",
    "DAO governance",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
