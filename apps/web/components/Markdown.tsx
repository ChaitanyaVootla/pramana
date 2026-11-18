"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { EntityInline } from "@/components/chips/EntityInline";
import { ReaderContext, useReader } from "@/components/chips/reader";

/**
 * Markdown with the platform's link schemes. Inside a page reader, claim links
 * open the claim's evidence; entity links become people/place previews or
 * glossary terms. Elsewhere they navigate.
 */
export { ReaderContext };

const SCHEME = /^(claim|entity|source|excerpt|page):(.+)$/;

function urlTransform(url: string): string {
  return SCHEME.test(url) ? url : defaultUrlTransform(url);
}

const LINK =
  "text-indigo underline decoration-indigo-tint decoration-[1.5px] underline-offset-3 transition-[text-decoration-color] hover:decoration-indigo";

function PlatformLink({ href, children }: { href?: string; children?: ReactNode }) {
  const ctx = useReader();
  const m = href ? SCHEME.exec(href) : null;
  if (!m) {
    const external = href?.startsWith("http");
    return (
      <a
        href={href}
        className={LINK}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  const [, scheme, target] = m;
  if (scheme === "claim") {
    if (ctx.selectClaim) {
      // An inline link (not a button) so long claim text wraps like the prose around it.
      return (
        <a
          href={`#claim-${target}`}
          data-claim={target}
          className="claim-link"
          aria-current={ctx.selectedClaim === target ? "true" : undefined}
          title={ctx.claimText?.(target!)}
          onClick={(e) => {
            e.preventDefault();
            ctx.selectClaim!(target!);
          }}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={`/c/${target}`} className="claim-link">
        {children}
      </Link>
    );
  }
  if (scheme === "entity") {
    const entity = ctx.entity?.(target!);
    if (entity)
      return (
        <EntityInline entity={entity} within={ctx.within}>
          {children}
        </EntityInline>
      );
    return (
      <Link href={ctx.entityHref?.(target!) ?? `/e/${target}`} className={LINK}>
        {children}
      </Link>
    );
  }
  const base = scheme === "source" ? "/s/" : scheme === "page" ? "/p/" : null;
  if (base)
    return (
      <Link href={`${base}${target}`} className={LINK}>
        {children}
      </Link>
    );
  return <span>{children}</span>;
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={{ a: PlatformLink }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
