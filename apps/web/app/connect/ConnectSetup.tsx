"use client";

import { Check, Copy, Download, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { rotateTokenAction } from "./actions";

const TOKEN = "{{token}}";

/** What to ask the AI once it is set up: it answers by looking up its session here. */
export const ASK_CONNECTED = "Are you connected to Pramāṇa?";

function mask(token: string): string {
  return `${token.slice(0, 4)}${"•".repeat(12)}${token.slice(-4)}`;
}

/** A copy-ready block in a field. Shows the token masked unless the reader asked to see it; always copies it whole. */
function Snippet({
  text,
  token = "",
  reveal = false,
  label,
  prose = false,
}: {
  text: string;
  token?: string;
  reveal?: boolean;
  label: string;
  /** A sentence to paste, in the reading face and wrapped, not code. */
  prose?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.replaceAll(TOKEN, token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the text and copy it instead.");
    }
  };
  return (
    <div className="field relative mt-2">
      <pre
        className={cn(
          "scroll-thin overflow-x-auto p-3 pr-24 leading-relaxed text-ink",
          prose ? "font-sans text-ui whitespace-pre-wrap" : "font-mono text-[0.8125rem] whitespace-pre",
        )}
      >
        {text.replaceAll(TOKEN, reveal ? token : mask(token))}
      </pre>
      <Button
        variant="outline"
        size="sm"
        onClick={copy}
        className="absolute top-2 right-2 bg-paper"
      >
        {copied ? <Check className="text-indigo" /> : <Copy />}
        {copied ? "Copied" : "Copy"}
        <span className="sr-only"> {label}</span>
      </Button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-1">
      <span className="text-ink-3 tnum">{n}.</span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

/** The last step everywhere: ask the AI, in a sentence to paste. */
function AskStep({ n }: { n: number }) {
  return (
    <Step n={n}>
      In a new chat, ask Claude this. The sentence at the top of this page then says your AI is
      connected.
      <Snippet text={ASK_CONNECTED} label="the question" prose />
    </Step>
  );
}

const link =
  "text-indigo underline decoration-indigo-tint underline-offset-2 hover:decoration-indigo";

/**
 * The set-up for each kind of client, under a tab row (docs/visual.md §6). Claude Desktop gets a
 * one-click extension made for this computer; the others a copy-ready command or settings.
 */
export function ConnectSetup({
  url,
  token,
  root,
  node,
  extension,
  className,
}: {
  url: string;
  token: string;
  /** The project folder, for the stdio set-up and the bridge. */
  root: string;
  /** The Node.js that runs this server, for a settings file that starts the bridge. */
  node: string;
  /** The desktop extension's file name, as it downloads. */
  extension: string;
  className?: string;
}) {
  const claudeCode = `claude mcp add --transport http pramana ${url} \\\n  --header "Authorization: Bearer ${TOKEN}"`;
  const bridge = `${root}/apps/mcp/bridge/index.cjs`;
  const desktop = JSON.stringify(
    {
      mcpServers: {
        pramana: {
          command: node,
          args: [bridge],
          env: { PRAMANA_MCP_URL: url, PRAMANA_MCP_TOKEN: TOKEN },
        },
      },
    },
    null,
    2,
  );
  const generic = JSON.stringify(
    {
      mcpServers: { pramana: { type: "http", url, headers: { Authorization: `Bearer ${TOKEN}` } } },
    },
    null,
    2,
  );
  const stdio = `claude mcp add pramana -- \\\n  ${root}/node_modules/.bin/tsx ${root}/apps/mcp/src/main.ts`;

  return (
    <section className={cn("font-sans", className)} aria-labelledby="setup-heading">
      <h2 id="setup-heading" className="font-serif text-xl text-ink">
        Set up your AI
      </h2>
      <p className="mt-1.5 text-note text-ink-2">
        You need Claude Desktop or Claude Code on this computer. You do this once; after that it
        connects by itself whenever Pramāṇa is running.
      </p>
      <Tabs defaultValue="desktop" className="mt-3">
        {/* On a phone the four tabs wrap to two rows; the rows keep a little air between them. */}
        <TabsList variant="line" className="flex-wrap justify-start gap-y-1 group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="desktop">Claude Desktop app</TabsTrigger>
          <TabsTrigger value="claude-code">Claude Code (terminal)</TabsTrigger>
          <TabsTrigger value="other">Other AI apps</TabsTrigger>
          <TabsTrigger value="stdio">From the project folder (advanced)</TabsTrigger>
        </TabsList>

        <TabsContent value="desktop" className="mt-3">
          <p className="text-ui text-ink-2">
            <span className="text-ink">What this does:</span> installs Pramāṇa in Claude Desktop as
            an extension, so Claude can read the evidence here and post its answers beside what you
            read. Nothing else to install, and no terminal.
          </p>
          <ol className="mt-3 space-y-3 text-ui text-ink-2">
            <Step n={1}>
              <a
                href="/connect/extension"
                download={extension}
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "mb-1")}
              >
                <Download />
                Download the extension
              </a>
              <p className="mt-1">
                It is made for this computer and holds your key, so keep it to yourself.
              </p>
            </Step>
            <Step n={2}>
              Open the file you downloaded, <code className="text-ink">{extension}</code>. Claude
              Desktop opens and shows Pramāṇa: click <span className="text-ink">Install</span>. If
              nothing happens, drag the file onto the Claude Desktop window.
            </Step>
            <AskStep n={3} />
          </ol>
          <details className="mt-5 text-ui text-ink-2">
            <summary className="cursor-pointer text-ink">
              Can&rsquo;t install extensions? Change the settings file instead
            </summary>
            <ol className="mt-3 space-y-3">
              <Step n={1}>
                In Claude Desktop, open <span className="text-ink">Settings</span>, then{" "}
                <span className="text-ink">Developer</span>, then{" "}
                <span className="text-ink">Edit Config</span>. A file called{" "}
                <code className="text-ink">claude_desktop_config.json</code> opens.
              </Step>
              <Step n={2}>
                Copy this and paste it into the file. If the file is empty or holds only{" "}
                <code className="text-ink">{"{}"}</code>, replace everything. If it already has{" "}
                <code className="text-ink">mcpServers</code>, add the{" "}
                <code className="text-ink">pramana</code> part inside it.
                <Snippet text={desktop} token={token} label="the Claude Desktop settings" />
              </Step>
              <Step n={3}>Save the file, quit Claude Desktop completely and open it again.</Step>
              <AskStep n={4} />
            </ol>
          </details>
          <p className="mt-4 text-sm text-ink-3">
            Why not Claude Desktop&rsquo;s Connectors? Those are reached from Anthropic&rsquo;s
            servers, which cannot see this computer. The extension runs here instead.
          </p>
        </TabsContent>

        <TabsContent value="claude-code" className="mt-3">
          <p className="text-ui text-ink-2">
            <span className="text-ink">What this does:</span> tells Claude Code, in a terminal,
            where Pramāṇa is and gives it the key.
          </p>
          <ol className="mt-3 space-y-3 text-ui text-ink-2">
            <Step n={1}>
              Open a terminal (on a Mac, the Terminal app), paste this command and press Return.
              To use Pramāṇa from any folder, add <code className="text-ink">--scope user</code>{" "}
              after <code className="text-ink">pramana</code>.
              <Snippet text={claudeCode} token={token} label="the Claude Code command" />
            </Step>
            <Step n={2}>
              In Claude Code, type <code className="text-ink">/mcp</code> and press Return. You
              should see <span className="text-ink">pramana</span> listed as connected.
            </Step>
            <AskStep n={3} />
          </ol>
        </TabsContent>

        <TabsContent value="other" className="mt-3">
          <p className="text-ui text-ink-2">
            <span className="text-ink">What this does:</span> for other AI apps that support MCP (a
            standard way for AI apps to use tools), if they can connect over Streamable HTTP and
            send a header: the address and the key.
          </p>
          <dl className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-ui">
            <dt className="text-ink-3">Address</dt>
            <dd className="break-all text-ink">{url}</dd>
            <dt className="text-ink-3">Transport</dt>
            <dd className="text-ink">Streamable HTTP</dd>
            <dt className="text-ink-3">Header</dt>
            <dd className="break-all text-ink">Authorization: Bearer {mask(token)}</dd>
          </dl>
          <p className="mt-3 text-ui text-ink-2">Many apps take settings like this:</p>
          <Snippet text={generic} token={token} label="the settings" />
          <p className="mt-3 text-ui text-ink-2">
            An app that can only start programs on your computer can start the bridge instead, as
            in the Claude Desktop settings file above.
          </p>
        </TabsContent>

        <TabsContent value="stdio" className="mt-3">
          <p className="text-ui text-ink-2">
            <span className="text-ink">What this does:</span> lets your AI start Pramāṇa&rsquo;s
            server itself, with no web server running and no key. It uses the database and user
            named in the project&rsquo;s <code className="text-ink">.env</code>. Claude Code started
            in the project folder finds it on its own (from{" "}
            <code className="text-ink">.mcp.json</code>); from anywhere else:
          </p>
          <Snippet text={stdio} label="the command" />
          <p className="mt-3 text-ui text-ink-2">
            In Claude Code, Pramāṇa&rsquo;s ready-made questions also appear as commands, such as{" "}
            <code className="text-ink">/pramana:explain_claim</code>.
          </p>
        </TabsContent>
      </Tabs>
      <p className="mt-6 text-ui text-ink-2">
        <span className="text-ink">Only use an AI in a web browser?</span> It cannot reach this
        computer, so it cannot read the evidence here or put notes beside what you read. You can
        still paste in what you are reading and ask about it, but check its answers against the
        sources on the page.
      </p>
    </section>
  );
}

/**
 * The key, after the steps (the extension and the copy buttons already hold it): shown masked,
 * with a way to make a new one.
 */
export function YourKey({ token, className }: { token: string; className?: string }) {
  const [reveal, setReveal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const rotate = () =>
    start(async () => {
      const result = await rotateTokenAction();
      setConfirming(false);
      if (result.ok) {
        toast.success(result.message ?? "New key made.");
        router.refresh();
      } else toast.error(`Could not make a new key: ${result.error}`);
    });

  return (
    <section className={cn("font-sans", className)} aria-labelledby="token-heading">
      <h2 id="token-heading" className="font-serif text-xl text-ink">
        Your key
      </h2>
      <p className="mt-1.5 text-note text-ink-2">
        Your AI uses this key to sign in to Pramāṇa; the extension and the set-ups on this page
        already include it. It works only on this computer. Keep it private; if someone else sees it, make
        a new one.
      </p>
      <Snippet text={TOKEN} token={token} reveal={reveal} label="the key" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setReveal((r) => !r)} aria-pressed={reveal}>
          {reveal ? <EyeOff /> : <Eye />}
          {reveal ? "Hide the key" : "Show the key"}
        </Button>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2 text-ui text-ink-2">
            Any AI set up with the old key stops working until you set it up again.
            <Button variant="destructive" size="sm" onClick={rotate} disabled={pending}>
              {pending ? "Making…" : "Make a new key"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
              Keep this one
            </Button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Make a new key
          </Button>
        )}
      </div>
    </section>
  );
}
