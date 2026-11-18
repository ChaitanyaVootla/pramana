import { getCanvas, humanContext, NotFoundError } from "@pramana/services";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CanvasBoard } from "@/components/canvas/CanvasBoard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  try {
    return await getCanvas(await humanContext(), id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const c = await load(id);
  return { title: c.title };
}

export default async function CanvasRoute({ params }: Params) {
  const { id } = await params;
  // The board takes the whole width under the top bar: no frame, no sidebar, and no footer (globals.css hides
  // it from the first paint for this route, so nothing shifts when a phone switches to the list).
  return (
    <div data-canvas-board className="contents">
      <CanvasBoard initial={await load(id)} />
    </div>
  );
}
