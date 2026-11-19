import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Anek_Devanagari, Anek_Latin, Noto_Sans_Brahmi, Tiro_Devanagari_Sanskrit } from "next/font/google";
import { getPresence, getStats, getUserView, humanContext } from "@pramana/services";
import { currentAccount } from "@/lib/auth";
import { BottomNav } from "@/components/shell/BottomNav";
import { Providers } from "@/components/shell/Providers";
import { ThemeColor } from "@/components/shell/ThemeColor";
import { Appearance } from "@/components/shell/Appearance";
import { APPEARANCE_COOKIE, appearanceAttributes, parseAppearance } from "@/components/shell/appearance-settings";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { TopBar } from "@/components/shell/TopBar";
import { cn } from "@/lib/utils";
import "./globals.css";

/*
 * Type (docs/visual.md): two voices. Anek Latin, with Anek Devanagari beside
 * it, is the platform speaking: titles, navigation, labels and numbers, drawn
 * narrow and firm for titles (its width axis). Tiro Devanagari Sanskrit is
 * history speaking: prose, claims and quotations, with the Devanagari in them.
 * Both carry every IAST mark (ā ī ū ṛ ṅ ñ ṭ ḍ ṇ ś ṣ ḥ ṃ) as a designed glyph
 * (verified by rendering). Noto Sans Brahmi for the wordmark.
 */
const anek = Anek_Latin({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-anek",
  display: "swap",
});
const anekDeva = Anek_Devanagari({
  subsets: ["devanagari"],
  axes: ["wdth"],
  variable: "--font-anek-deva",
  display: "swap",
});
const tiro = Tiro_Devanagari_Sanskrit({
  subsets: ["devanagari", "latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-tiro",
  display: "swap",
});
const brahmi = Noto_Sans_Brahmi({
  subsets: ["brahmi"],
  weight: "400",
  variable: "--font-noto-brahmi",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Pramāṇa", template: "%s · Pramāṇa" },
  description: "Indian history, with the evidence attached.",
  applicationName: "Pramāṇa",
  ...(process.env.PRAMANA_WEB_URL?.startsWith("https://") ? { metadataBase: new URL(process.env.PRAMANA_WEB_URL) } : {}),
  authors: [{ name: "Vootla Chaitanya", url: "https://vootlachaitanya.com" }],
  creator: "Vootla Chaitanya",
  openGraph: {
    type: "website",
    siteName: "Pramāṇa",
    title: "Pramāṇa: Indian history, with the evidence attached",
    description:
      "Every statement points to the exact words it rests on, in a source you can open. Where historians disagree, you see each reading.",
  },
  appleWebApp: { capable: true, title: "Pramāṇa", statusBarStyle: "default" },
};

/* PWA-ready: edge-to-edge on notched phones; the browser chrome follows the slab (the top bar). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#151b66" },
    { media: "(prefers-color-scheme: dark)", color: "#191f70" },
  ],
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const human = humanContext();
  const [stats, jar, presence, siteView, account] = await Promise.all([
    getStats(),
    cookies(),
    // This learner's own AI sessions, for the presence glyph (docs/visual.md §7); absent, the glyph is dotted.
    human.then((h) => getPresence(h.actorId)).catch(() => ({ connected: false })),
    // The learner's site-wide view holds the appearance panel's choices (docs/visual.md §4).
    human.then((h) => getUserView(h, "site", "site")).catch(() => null),
    currentAccount(),
  ]);
  // Text size, line width and evidence density: from the learner's view, else as last set on this device.
  const appearance = siteView?.view.appearance ?? parseAppearance(jar.get(APPEARANCE_COOKIE)?.value);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(anek.variable, anekDeva.variable, tiro.variable, brahmi.variable)}
      {...appearanceAttributes(appearance)}
    >
      {/* A column as tall as the screen: short pages (a 404) keep the footer at the bottom. */}
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <ThemeColor />
          <TopBar pending={stats.pendingChangesets} themeSwitch={<Appearance initial={appearance} stored={Boolean(siteView?.view.appearance)} version={siteView?.version ?? 0} />} connected={presence.connected} account={account} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter claims={stats.claims} sources={stats.sources} pending={stats.pendingChangesets} />
          <BottomNav connected={presence.connected} />
        </Providers>
      </body>
    </html>
  );
}
