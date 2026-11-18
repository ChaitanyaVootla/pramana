import { entityAffiliations, listEntities, listPages } from "@pramana/services";
import { PeopleBrowser, type PeopleAge } from "@/components/people/PeopleBrowser";
import { Frame } from "@/components/shell/Frame";
import { EmptyState } from "@/components/ui/empty-state";
import { loadAges } from "@/lib/ages";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const [people, pages] = await Promise.all([listEntities(["person"]), listPages()]);
  const ages: PeopleAge[] = (await loadAges(pages)).map((a) => ({
    id: a.id,
    label: a.label,
    whenLabel: a.whenLabel,
    from: a.from,
    to: a.to,
    pageSlug: pages.find((p) => p.kind === "era" && p.entity?.id === a.id)?.slug ?? null,
  }));
  const affiliations = await entityAffiliations(people.map((p) => p.id));
  const dated = people.filter((p) => p.bounds?.startMin != null || p.spans?.length).length;

  return (
    <Frame className="pt-8 pb-8 sm:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="max-w-[64ch]">
          <h1 className="text-3xl text-ink sm:text-4xl">People</h1>
          <p className="mt-2 font-sans text-note text-ink-2">
            Everyone the pages mention, grouped by the age you meet them in. Each group shares one
            line of time, so you can see who was alive, or in power, together.
          </p>
        </div>
        <p className="font-sans text-sm text-ink-3 tnum">
          {people.length} people, {dated} with dates
        </p>
      </header>
      <div className="mt-6">
        {people.length ? (
          <PeopleBrowser people={people} ages={ages} affiliations={affiliations} />
        ) : (
          <EmptyState title="Nobody yet.">People arrive with the pages that mention them.</EmptyState>
        )}
      </div>
    </Frame>
  );
}
