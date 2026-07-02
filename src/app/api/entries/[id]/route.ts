import { NextRequest, NextResponse } from "next/server";
import { updateEntryDescription } from "@/lib/entries";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Edit an existing memory. Only the free-text description is editable here;
// photos are managed via the /photos sub-route.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const { id } = await ctx.params;

  let body: { description?: unknown };
  try {
    body = (await req.json()) as { description?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.description !== "string" && body.description !== null) {
    return NextResponse.json(
      { ok: false, error: "`description` must be a string or null." },
      { status: 400 },
    );
  }

  try {
    await updateEntryDescription(id, body.description);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/entries PATCH] failed:", err);
    return NextResponse.json({ ok: false, error: "Could not save the description." }, { status: 500 });
  }
}
