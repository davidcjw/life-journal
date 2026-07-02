import { NextRequest, NextResponse } from "next/server";
import { addEntryPhoto, deleteEntryPhoto, normalizeImageExt } from "@/lib/entries";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

// Add a photo to an existing memory (multipart form, field name "photo").
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const { id } = await ctx.params;

  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("photo");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ ok: false, error: "Expected a multipart upload." }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ ok: false, error: "No photo was uploaded." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "Only image files are allowed." }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "That image is too large (max 15 MB)." }, { status: 413 });
  }

  const ext = normalizeImageExt(file.name || file.type.split("/").pop() || "jpg");
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const result = await addEntryPhoto(id, bytes, ext);
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      const error =
        result.reason === "not_found" ? "That memory no longer exists." : "This memory is already full.";
      return NextResponse.json({ ok: false, error }, { status });
    }
    return NextResponse.json({ ok: true, item: result.item });
  } catch (err) {
    console.error("[api/entries photos POST] failed:", err);
    return NextResponse.json({ ok: false, error: "Could not add that photo." }, { status: 500 });
  }
}

// Remove a photo from a memory (JSON body: { path }).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const { id } = await ctx.params;

  let body: { path?: unknown };
  try {
    body = (await req.json()) as { path?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.path !== "string" || !body.path) {
    return NextResponse.json({ ok: false, error: "`path` is required." }, { status: 400 });
  }

  try {
    const result = await deleteEntryPhoto(id, body.path);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: "That photo was not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/entries photos DELETE] failed:", err);
    return NextResponse.json({ ok: false, error: "Could not remove that photo." }, { status: 500 });
  }
}
