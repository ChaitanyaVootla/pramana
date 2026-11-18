import Link from "next/link";
import { Lede, PageContainer, PageTitle } from "@/components/pages/Shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageContainer narrow className="pt-12 sm:pt-16">
      <p className="font-sans text-ui text-ink-2">Page not found</p>
      <PageTitle className="mt-1" size="md">Nothing is written here yet</PageTitle>
      <Lede>
        There is no page at this address yet, or the link may be mistyped. Pick an age to read, or search for a person, place or phrase.
      </Lede>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button nativeButton={false} render={<Link href="/p/ages-of-indian-history" />}>
          Pages to read
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/search" />}>
          Search the site
        </Button>
      </div>
    </PageContainer>
  );
}
