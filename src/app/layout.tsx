import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Siyahı Yoxlama Sistemi",
  description: "AI əsaslı Excel və şəxsiyyət sənədi yoxlama platforması",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-x-hidden">
              <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
