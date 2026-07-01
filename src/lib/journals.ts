import "server-only";
import { getServiceClient } from "./supabase";
import { config } from "./config";

/**
 * A journal is one photo book. A deployment can hold several at once; entries,
 * the web book, exports, and the bot's create/edit flows are all scoped to one.
 */
export type Journal = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  created_at: string;
};

const JOURNAL_COLS = "id,slug,title,subtitle,created_at";

/** Turn free text into a URL-safe slug (falls back to "journal"). */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "journal"
  );
}

/** All journals, oldest first. The oldest doubles as the "default" journal. */
export async function getJournals(): Promise<Journal[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("journals")
    .select(JOURNAL_COLS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Journal[];
}

export async function getJournalBySlug(slug: string): Promise<Journal | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("journals")
    .select(JOURNAL_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Journal | null) ?? null;
}

export async function getJournalById(id: string): Promise<Journal | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("journals")
    .select(JOURNAL_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Journal | null) ?? null;
}

/** Pick a slug derived from `title` that no existing journal uses. */
async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("journals")
    .select("slug")
    .like("slug", `${base}%`);
  if (error) throw error;
  const taken = new Set((data ?? []).map((r) => (r as { slug: string }).slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Create a new journal. `title` is required; `subtitle` is optional. */
export async function createJournal(title: string, subtitle = ""): Promise<Journal> {
  const cleanTitle = title.trim().slice(0, 200) || "Untitled Journal";
  const cleanSubtitle = subtitle.trim().slice(0, 200);
  const slug = await uniqueSlug(cleanTitle);
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("journals")
    .insert({ slug, title: cleanTitle, subtitle: cleanSubtitle })
    .select(JOURNAL_COLS)
    .single();
  if (error) throw error;
  return data as Journal;
}

/**
 * Ensure at least one journal exists and return the default (oldest) one.
 *
 * On first run — or when upgrading a single-journal deployment — this creates a
 * journal from the configured cover text and adopts any pre-existing entries
 * (rows with a null journal_id) into it so nothing is orphaned.
 */
export async function ensureDefaultJournal(): Promise<Journal> {
  const existing = await getJournals();
  if (existing.length) return existing[0];

  const journal = await createJournal(config.title, config.subtitle);
  const supabase = getServiceClient();
  // Adopt legacy entries that predate multi-journal support.
  await supabase
    .from("journal_entries")
    .update({ journal_id: journal.id })
    .is("journal_id", null);
  return journal;
}

// ── Per-chat active journal (which book the bot writes to) ────────────────────

/** The journal the given chat is currently adding/editing memories in. */
export async function getActiveJournal(chatId: number): Promise<Journal> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("journal_bot_settings")
    .select("active_journal_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  const activeId = (data as { active_journal_id: string | null } | null)?.active_journal_id ?? null;
  if (activeId) {
    const journal = await getJournalById(activeId);
    if (journal) return journal;
  }
  return ensureDefaultJournal();
}

/** Remember which journal a chat is working in. */
export async function setActiveJournal(chatId: number, journalId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("journal_bot_settings")
    .upsert({ chat_id: chatId, active_journal_id: journalId }, { onConflict: "chat_id" });
  if (error) throw error;
}
