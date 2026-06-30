import { getEntries, downloadPhotoDataUri } from "@/lib/entries";
import { buildExportHtml, type ExportEntry } from "@/lib/html-export";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "journal";
}

export async function GET() {
  try {
    const entries = await getEntries();

    const exportEntries: ExportEntry[] = await Promise.all(
      entries.map(async (e) => {
        const uris = await Promise.all(e.photos.map((p) => downloadPhotoDataUri(p)));
        return {
          event_date: e.event_date,
          title: e.title,
          description: e.description,
          photoDataUris: uris.filter((u): u is string => Boolean(u)),
        };
      }),
    );

    const today = new Date().toISOString().slice(0, 10);
    const html = buildExportHtml({
      title: config.title,
      subtitle: config.subtitle,
      entries: exportEntries,
      generatedAt: today,
    });

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `attachment; filename="${slug(config.title)}-${today}.html"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export/html] failed:", err);
    return new Response("Could not generate the export. Check the server configuration.", {
      status: 500,
    });
  }
}
