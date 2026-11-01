import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Newsreader } from "next/font/google";
import "@fontsource/noto-sans-bengali/400.css";
import "@fontsource/noto-sans-bengali/500.css";
import "@fontsource/noto-sans-bengali/600.css";
import "@/app/globals.css";
import "@/app/premium.css";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { Toaster } from "sonner";

const display = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "CivicSense — Campus problems, understood",
  description: "A bilingual campus issue reporting and resolution workspace for university communities.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${GeistSans.variable} ${display.variable}`}><body><WorkspaceProvider>{children}</WorkspaceProvider><Toaster position="bottom-right" richColors /></body></html>;
}
