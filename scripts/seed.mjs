#!/usr/bin/env node
/**
 * Seed sample memories so you can preview the book without the bot.
 *
 *   node --env-file=.env.local scripts/seed.mjs          # add samples
 *   node --env-file=.env.local scripts/seed.mjs --clear  # remove ALL entries + seed photos
 *
 * Photos are generated gradient SVGs uploaded to the private bucket.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_PHOTOS_BUCKET || "journal-photos";
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(url, key, { auth: { persistSession: false } });

function svg(label, [c1, c2]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <text x="600" y="470" font-family="Georgia, serif" font-size="84" fill="rgba(255,255,255,0.92)"
        text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;
}

const palettes = [
  ["#f6d365", "#fda085"], ["#a1c4fd", "#c2e9fb"], ["#fbc2eb", "#a6c1ee"],
  ["#84fab0", "#8fd3f4"], ["#ffecd2", "#fcb69f"], ["#d4fc79", "#96e6a1"],
  ["#e0c3fc", "#8ec5fc"], ["#f093fb", "#f5576c"], ["#5ee7df", "#b490ca"],
];

async function uploadSvg(label, palette) {
  const path = `entries/seed-${crypto.randomUUID()}.svg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, new Blob([svg(label, palette)], { type: "image/svg+xml" }), {
      contentType: "image/svg+xml",
      upsert: true,
    });
  if (error) throw error;
  return path;
}

async function clearAll() {
  // remove all seed photos
  const { data: files } = await supabase.storage.from(bucket).list("entries", { limit: 1000 });
  const seedPaths = (files ?? []).filter((f) => f.name.startsWith("seed-")).map((f) => `entries/${f.name}`);
  if (seedPaths.length) await supabase.storage.from(bucket).remove(seedPaths);
  const { error } = await supabase.from("journal_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
  console.log(`Cleared all entries and ${seedPaths.length} seed photo(s).`);
}

const samples = [
  { event_date: "2025-09-14", title: "The day we brought him home", description: "Tiny, perfect, and already so loved. The whole house felt different — fuller, softer, ours.", photos: 1 },
  { event_date: "2025-12-25", title: "First Christmas", description: "More interested in the wrapping paper than the gifts. We wouldn't have it any other way.", photos: 3 },
  { event_date: "2026-02-02", title: "First time at the beach", description: "He stared at the waves for a full minute, then laughed at the sand between his toes.", photos: 2 },
  { event_date: "2026-04-19", title: "Learning to crawl", description: null, photos: 1 },
  { event_date: "2026-06-30", title: "His first birthday", description: "One whole year. We blinked and here we are — cake on the face, joy everywhere.", photos: 3 },
];

async function seed() {
  let i = 0;
  for (const s of samples) {
    const photos = [];
    for (let p = 0; p < s.photos; p++) {
      photos.push(await uploadSvg(`${i + 1}.${p + 1}`, palettes[(i + p) % palettes.length]));
    }
    const { error } = await supabase.from("journal_entries").insert({
      event_date: s.event_date,
      title: s.title,
      description: s.description,
      photos,
    });
    if (error) throw error;
    console.log(`+ ${s.event_date}  ${s.title}  (${photos.length} photo${photos.length === 1 ? "" : "s"})`);
    i++;
  }
  console.log(`\nSeeded ${samples.length} memories.`);
}

if (process.argv.includes("--clear")) {
  await clearAll();
} else {
  await seed();
}
