import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, Noto_Sans_Brahmi, Tiro_Devanagari_Sanskrit } from "next/font/google";
import Link from "next/link";
import { getPresence, getStats, getUserView, humanContext } from "@pramana/services";
import { BottomNav } from "@/components/shell/BottomNav";
import { Frame } from "@/components/shell/Frame";
import { Providers } from "@/components/shell/Providers";
import { ThemeColor } from "@/components/shell/ThemeColor";
import { Appearance } from "@/components/shell/Appearance";
import { APPEARANCE_COOKIE, appearanceAttributes, parseAppearance } from "@/components/shell/appearance-settings";
import { TopBar } from "@/components/shell/TopBar";
import { cn } from "@/lib/utils";
import "./globals.css";

/*
 * Type (docs/visual.md): Tiro Devanagari Sanskrit for display, reading and
 * Devanagari. Its Latin was drawn for romanised Sanskrit beside its Devanagari,
 * so a bilingual title is one voice, and every IAST mark (ā ī ū ṛ ṅ ñ ṭ ḍ ṇ ś ṣ
 * ḥ ṃ) is a designed glyph (verified by rendering). Inter for the interface;
 * Noto Sans Brahmi for the wordmark.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
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
  appleWebApp: { capable: true, title: "Pramāṇa", statusBarStyle: "default" },
};

/* PWA-ready: edge-to-edge on notched phones; the chrome follows the ground colour. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1015" },
  ],
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const human = humanContext();
  const [stats, jar, presence, siteView] = await Promise.all([
    getStats(),
    cookies(),
    // This learner's own AI sessions, for the presence glyph (docs/visual.md §7); absent, the glyph is dotted.
    human.then((h) => getPresence(h.actorId)).catch(() => ({ connected: false })),
    // The learner's site-wide view holds the appearance panel's choices (docs/visual.md §4).
    human.then((h) => getUserView(h, "site", "site")).catch(() => null),
  ]);
  // Text size, line width and evidence density: from the learner's view, else as last set on this device.
  const appearance = siteView?.view.appearance ?? parseAppearance(jar.get(APPEARANCE_COOKIE)?.value);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(inter.variable, tiro.variable, brahmi.variable)}
      {...appearanceAttributes(appearance)}
    >
      {/* A column as tall as the screen: short pages (a 404) keep the footer at the bottom. */}
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <ThemeColor />
          <TopBar pending={stats.pendingChangesets} themeSwitch={<Appearance initial={appearance} stored={Boolean(siteView?.view.appearance)} version={siteView?.version ?? 0} />} connected={presence.connected} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Frame as="footer" className="mt-10 pb-8 sm:mt-12">
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-5 font-sans text-sm text-ink-3">
              <span>
                {stats.claims} claims from {stats.sources} sources
              </span>
              <Link href="/review" className="transition-colors hover:text-ink">
                Proposed changes
              </Link>
              <Link href="/audit" className="transition-colors hover:text-ink">
                History of changes
              </Link>
              <Link href="/insights" className="transition-colors hover:text-ink">
                Insights
              </Link>
              <Link href="/connect" className="transition-colors hover:text-ink">
                Connect your AI
              </Link>
              <span>Code AGPL-3.0, content CC BY-SA 4.0</span>
            </div>
          </Frame>
          <BottomNav connected={presence.connected} />
        </Providers>
      </body>
    </html>
  );
}
