import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import { buildSearchIndex } from "@/components/shell/search-index";
import { ToastProvider } from "@/components/ui/toast";
import { DemoStateProvider } from "@/demo-state/provider";
import { getCurrentUser, getOrganization, listAlertHeadlines, listStores } from "@/services/core";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Rankvora AI", template: "%s · Rankvora AI" },
  description: "AI visibility and website intelligence for every website and brand you manage.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f6fa",
};

// Light is the default. Only a theme the user picked with the toggle (saved in localStorage) is applied, before first paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem("rv-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [org, user, stores, alerts] = await Promise.all([getOrganization(), getCurrentUser(), listStores(), listAlertHeadlines()]);
  const searchIndex = await buildSearchIndex(stores);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <ToastProvider>
          <DemoStateProvider>
            <AppShell org={org} user={user} stores={stores} alerts={alerts} searchIndex={searchIndex}>
              {children}
            </AppShell>
          </DemoStateProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
