import { getCanvas, humanContext, NotFoundError } from "@pramana/services";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** One of the learner's canvases, loaded live (the open board refetches it when it changes). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await getCanvas(await humanContext(), id));
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
