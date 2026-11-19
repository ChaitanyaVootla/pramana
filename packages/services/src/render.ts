import type { Block } from "@pramana/core";
import type { MediaCard } from "./media";
import type { ClaimCard, PageView } from "./queries";

/**
 * Plain-text rendering of a page for agents: readable, but keeps the ids an
 * agent needs to cite, quiz, or propose edits (block ids, claim ids).
 */

function claimLine(c: ClaimCard | undefined, id: string): string {
  if (!c) return `- [missing claim ${id}]`;
  const cites = c.citations
    .map(
      (x) =>
        `${x.excerpt.source.short}${x.excerpt.locatorLabel ? `, ${x.excerpt.locatorLabel}` : ""} [${x.stance}; quote: ${x.excerpt.verification.status}]`,
    )
    .join("; ");
  const when = c.whenLabel ? ` (${c.whenLabel})` : "";
  return `- ${c.text}${when}\n  ↳ claim ${c.id} · ${c.kind} · ${c.assessment} · L${c.level} ${c.levelLabel}${cites ? ` · ${cites}` : ""}`;
}

function renderBlock(b: Block, view: PageView): string {
  const tag = `[block ${b.id}${b.theme ? ` · ${b.theme}` : ""}]`;
  switch (b.type) {
    case "heading":
      return `${"#".repeat(b.level)} ${b.text} ${tag}`;
    case "prose":
      return `${tag}\n${b.markdown}`;
    case "callout":
      return `${tag} (${b.tone})\n> ${b.markdown.replace(/\n/g, "\n> ")}`;
    case "key_facts":
    case "claims":
      return `${tag} ${b.type === "key_facts" ? "Key facts" : "Claims"}${b.title ? `: ${b.title}` : ""}\n${b.claimIds.map((id) => claimLine(view.claims[id], id)).join("\n")}`;
    case "misconception":
      return `${tag} Misconception\n${claimLine(view.claims[b.claimId], b.claimId)}\n  Corrections:\n${b.correctionIds.map((id) => `  ${claimLine(view.claims[id], id)}`).join("\n")}`;
    case "debate":
      return `${tag} Debate: ${b.question}\n${b.positions
        .map(
          (p) =>
            `* ${p.label}\n${p.claimIds.map((id) => `  ${claimLine(view.claims[id], id)}`).join("\n")}`,
        )
        .join("\n")}${b.note ? `\n${b.note}` : ""}`;
    case "quote": {
      const e = view.excerpts[b.excerptId];
      return `${tag} Quote: “${e?.quote ?? "?"}” — ${e?.source.short ?? "?"}${e?.locatorLabel ? `, ${e.locatorLabel}` : ""}`;
    }
    case "entities":
      return `${tag} ${b.title ?? "Related"}: ${b.entityIds.map((id) => view.entities[id]?.label ?? id).join(", ")}`;
    case "chapter": {
      const meta = [
        b.when ? "dated" : b.phase === "later" ? "afterwards (how we know)" : null,
        b.places.length ? `places: ${b.places.map((r) => view.entities[r]?.label ?? r).join(", ")}` : null,
        b.people.length ? `people: ${b.people.map((r) => view.entities[r]?.label ?? r).join(", ")}` : null,
        b.terms.length ? `terms: ${b.terms.map((r) => view.entities[r]?.label ?? r).join(", ")}` : null,
      ].filter(Boolean);
      return `## ${b.title} ${tag}${b.promise ? `\n${b.promise}` : ""}${meta.length ? `\n(${meta.join("; ")})` : ""}`;
    }
    case "already_know":
      return `${tag} ${b.title ?? "You may already know"}\n${b.items.map((i) => `- ${view.entities[i.entity]?.label ?? i.entity}: ${i.text}`).join("\n")}`;
    case "meanwhile":
      return `${tag} ${b.title ?? "Meanwhile elsewhere"}\n${b.items.map((i) => `- ${i.region}: ${i.label}`).join("\n")}${b.note ? `\n${b.note}` : ""}`;
    case "viz": {
      const data = view.viz[b.id];
      const n =
        data?.kind === "timeline"
          ? `${data.items.length} items`
          : data?.kind === "map"
            ? `${data.features.length} places`
            : "";
      return `${tag} Visualisation (${b.viz.kind}${n ? `, ${n}` : ""})${b.caption ? `: ${b.caption}` : ""}`;
    }
    case "figure": {
      const m = view.media[b.media];
      return `${tag} Figure${b.size === "wide" ? " (wide)" : ""}: ${m ? mediaLine(m) : `[missing media ${b.media}]`}\n${b.caption}`;
    }
    case "gallery":
      return `${tag} Gallery${b.title ? `: ${b.title}` : ""}\n${b.items
        .map((i) => {
          const m = view.media[i.media];
          return `- ${m ? mediaLine(m) : `[missing media ${i.media}]`}${i.caption ? `\n  ${i.caption}` : ""}`;
        })
        .join("\n")}`;
    case "tracks": {
      const label = (ref: string) =>
        b.ages.find((a) => a.entity === ref)?.label ?? view.entities[ref]?.label ?? ref;
      const rows = b.facets.map((f) => {
        const cells = b.cells
          .filter((c) => c.facet === f.key)
          .map((c) => {
            const e = c.excerptId ? view.excerpts[c.excerptId] : undefined;
            const claims = c.claimIds.length ? ` [claims ${c.claimIds.join(", ")}]` : "";
            const quote = e ? `\n    > “${e.quote ?? "?"}” — ${e.source.short}` : "";
            return `  - ${label(c.age)}: ${c.text}${claims}${quote}`;
          });
        return `* ${f.label} (${f.key})${f.description ? `: ${f.description}` : ""}\n${cells.join("\n")}`;
      });
      const ages = b.ages.map((a) => label(a.entity)).join(", ");
      return `${tag} Across the ages${b.title ? `: ${b.title}` : ""} (${b.facets.length} facets by ${b.ages.length} ages: ${ages})${b.intro ? `\n${b.intro}` : ""}\n${rows.join("\n")}`;
    }
    default:
      // Block types added later render as their tag until they get a renderer here.
      return `${tag} ${(b as { type: string }).type}`;
  }
}

function mediaLine(m: MediaCard): string {
  return `“${m.title}” (media ${m.id} · ${m.representationLabel}${m.representationNote ? `: ${m.representationNote}` : ""} · ${m.attribution} · ${m.pageUrl})`;
}

export function pageToMarkdown(view: PageView): string {
  const p = view.page;
  const header = [
    `# ${p.title}`,
    `page ${p.id} · /${p.slug} · ${p.kind} · ${p.status} · v${p.version}`,
    p.entity
      ? `entity: ${p.entity.label} (${p.entity.slug}${p.entity.whenLabel ? `, ${p.entity.whenLabel}` : ""})`
      : null,
    p.spec.hero.media
      ? `lead image: ${view.media[p.spec.hero.media] ? mediaLine(view.media[p.spec.hero.media]!) : p.spec.hero.media}`
      : null,
    p.summary ? `\n${p.summary}` : null,
    `\nVerification: ${view.stats.claims} claims; by level ${JSON.stringify(view.stats.byLevel)}; pending changesets touching this page: ${view.stats.pendingChangesets}`,
  ]
    .filter(Boolean)
    .join("\n");
  return `${header}\n\n${p.blocks.map((b) => renderBlock(b, view)).join("\n\n")}`;
}
