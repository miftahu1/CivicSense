import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "@fontsource/noto-sans-bengali/400.css";
import "@fontsource/noto-sans-bengali/500.css";
import "@fontsource/noto-sans-bengali/600.css";
import "@/app/globals.css";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "CivicSense — Campus problems, understood",
  description: "A bilingual campus issue reporting and resolution workspace for Dibrugarh University.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={GeistSans.variable}><body><WorkspaceProvider>{children}</WorkspaceProvider><Toaster position="bottom-right" richColors /></body></html>;
}
