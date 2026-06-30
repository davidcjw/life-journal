import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getServiceClient } from "@/lib/supabase";
import {
  sendMessage,
  sendChatAction,
  getFilePath,
  downloadFile,
  answerCallbackQuery,
  editMessageText,
} from "@/lib/telegram";
import {
  getRecentEntries,
  getEntryById,
  updateEntryTitle,
  updateEntryDate,
  updateEntryDescription,
  addEntryPhoto,
  deleteEntryPhoto,
  type Entry,
} from "@/lib/entries";
import { parseDateInput, formatLongDate, formatShortDate } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Step =
  | "idle"
  | "awaiting_title"
  | "awaiting_date"
  | "awaiting_description"
  | "awaiting_photos"
  | "editing_title"
  | "editing_date"
  | "editing_description"
  | "editing_photos";

type Draft = {
  chat_id: number;
  step: Step;
  title: string | null;
  event_date: string | null;
  description: string | null;
  photos: string[];
  edit_entry_id: string | null;
};

type TgPhotoSize = { file_id: string; width: number; height: number };
type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; first_name?: string };
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
};
type TgCallbackQuery = {
  id: string;
  from?: { id: number };
  message?: { message_id: number; chat: { id: number; type: string } };
  data?: string;
};
type TgUpdate = { message?: TgMessage; callback_query?: TgCallbackQuery };

const ok = () => NextResponse.json({ ok: true });

// ── Draft persistence ────────────────────────────────────────────────────────
async function getDraft(chatId: number): Promise<Draft> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("journal_bot_drafts")
    .select("chat_id,step,title,event_date,description,photos,edit_entry_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  return (
    (data as Draft | null) ?? {
      chat_id: chatId,
      step: "idle",
      title: null,
      event_date: null,
      description: null,
      photos: [],
      edit_entry_id: null,
    }
  );
}

async function saveDraft(chatId: number, patch: Partial<Draft>): Promise<void> {
  const supabase = getServiceClient();
  await supabase
    .from("journal_bot_drafts")
    .upsert({ chat_id: chatId, ...patch }, { onConflict: "chat_id" });
}

async function deletePhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await getServiceClient().storage.from(config.photosBucket).remove(paths);
}

async function clearDraft(chatId: number, removePhotos = false): Promise<void> {
  const supabase = getServiceClient();
  if (removePhotos) {
    const draft = await getDraft(chatId);
    await deletePhotos(draft.photos);
  }
  await supabase.from("journal_bot_drafts").delete().eq("chat_id", chatId);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function isAllowed(chatId: number): boolean {
  if (config.allowedChatIds.length === 0) return true; // not locked down yet
  return config.allowedChatIds.includes(String(chatId));
}

function helpText(chatId: number): string {
  const lock =
    config.allowedChatIds.length === 0
      ? `\n\n⚙️ <i>Setup:</i> add <code>${chatId}</code> to <code>TELEGRAM_ALLOWED_CHAT_IDS</code> to lock this bot to you.`
      : "";
  return (
    "👋 <b>Welcome to your Live Journal.</b>\n\n" +
    "Add a memory to your photo book:\n" +
    "1. /new — start a memory\n" +
    "2. send the <b>title</b>\n" +
    "3. send the <b>date</b> (e.g. <code>2026-06-30</code>) or /today\n" +
    "4. send a <b>description</b>, or /skip\n" +
    "5. send up to <b>3 photos</b>\n" +
    "6. /done — save it ✨\n\n" +
    "✏️ <b>Edit a memory:</b> /edit — change the title, date, description, or photos of a recent memory.\n\n" +
    "Anytime: /cancel to discard, /help to see this." +
    lock
  );
}

async function publish(chatId: number): Promise<void> {
  const draft = await getDraft(chatId);
  if (!draft.title || !draft.event_date) {
    await sendMessage(chatId, "Hmm, this memory is missing a title or date. Send /new to start over.");
    await clearDraft(chatId, true);
    return;
  }
  const supabase = getServiceClient();
  const { error } = await supabase.from("journal_entries").insert({
    event_date: draft.event_date,
    title: draft.title,
    description: draft.description,
    photos: draft.photos,
  });
  if (error) {
    await sendMessage(chatId, "⚠️ Couldn't save that memory. Please try /done again.");
    return;
  }
  await clearDraft(chatId, false);
  const count = draft.photos.length;
  const link = config.siteUrl ? `\n\n📖 View your book: ${config.siteUrl}` : "";
  await sendMessage(
    chatId,
    `✅ <b>Saved to your journal!</b>\n\n` +
      `🗓️ ${formatLongDate(draft.event_date)}\n` +
      `📌 ${escapeHtml(draft.title)}\n` +
      `🖼️ ${count} photo${count === 1 ? "" : "s"}` +
      link,
  );
}

async function handlePhoto(chatId: number, draft: Draft, photo: TgPhotoSize[]): Promise<void> {
  if (draft.photos.length >= config.maxPhotos) {
    await sendMessage(chatId, `You already have ${config.maxPhotos} photos (the max). Send /done to save.`);
    return;
  }
  await sendChatAction(chatId, "upload_photo");
  const largest = photo[photo.length - 1]; // last size = highest resolution
  const filePath = await getFilePath(largest.file_id);
  if (!filePath) {
    await sendMessage(chatId, "⚠️ Couldn't fetch that photo from Telegram. Try sending it again.");
    return;
  }
  const { bytes } = await downloadFile(filePath);
  // Telegram serves files as application/octet-stream, which the bucket's mime
  // whitelist rejects — derive the type from the extension instead (photos are JPEG).
  const rawExt = (filePath.split(".").pop() || "").toLowerCase();
  const ext = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(rawExt) ? rawExt : "jpg";
  const objectPath = `entries/${crypto.randomUUID()}.${ext}`;

  const supabase = getServiceClient();
  const up = await supabase.storage
    .from(config.photosBucket)
    .upload(objectPath, bytes, { contentType: extToMime(ext), upsert: false });
  if (up.error) {
    console.error("[telegram webhook] storage upload failed:", up.error.message);
    await sendMessage(chatId, "⚠️ Couldn't store that photo. Try sending it again.");
    return;
  }

  // Atomic, race-safe append (albums arrive as concurrent webhook calls).
  const { data: photosAfter } = await supabase.rpc("journal_append_draft_photo", {
    p_chat_id: chatId,
    p_path: objectPath,
  });
  const arr = (photosAfter as string[] | null) ?? [];

  if (!arr.includes(objectPath)) {
    // Cap was already reached by a concurrent message — clean up the orphan.
    await deletePhotos([objectPath]);
    await sendMessage(chatId, `That's already ${config.maxPhotos} photos (the max). Send /done to save.`);
    return;
  }

  const n = arr.length;
  const tail =
    n >= config.maxPhotos ? "\nThat's the max — send /done to save." : "\nSend more, or /done to save.";
  await sendMessage(chatId, `📸 Photo ${n}/${config.maxPhotos} added.${tail}`);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function extToMime(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "image/jpeg";
  }
}

// ── Editing existing memories (inline-button driven) ─────────────────────────
type InlineButton = { text: string; callback_data: string };

function entrySummary(e: Entry): string {
  const desc = e.description ? escapeHtml(e.description) : "<i>(no description)</i>";
  const n = e.photos.length;
  return (
    "✏️ <b>Editing memory</b>\n\n" +
    `🗓️ ${formatLongDate(e.event_date)}\n` +
    `📌 ${escapeHtml(e.title)}\n` +
    `📝 ${desc}\n` +
    `🖼️ ${n}/${config.maxPhotos} photo${n === 1 ? "" : "s"}\n\n` +
    "What would you like to change?"
  );
}

function fieldMenu(id: string): { inline_keyboard: InlineButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: "📌 Title", callback_data: `ef:title:${id}` },
        { text: "🗓️ Date", callback_data: `ef:date:${id}` },
      ],
      [
        { text: "📝 Description", callback_data: `ef:desc:${id}` },
        { text: "🖼️ Photos", callback_data: `ef:photos:${id}` },
      ],
      [{ text: "✅ Done", callback_data: "ef:close" }],
    ],
  };
}

function photosMenu(e: Entry): { inline_keyboard: InlineButton[][] } {
  const rows: InlineButton[][] = e.photos.map((_, i) => [
    { text: `🗑️ Remove photo ${i + 1}`, callback_data: `ef:rm:${e.id}:${i}` },
  ]);
  if (e.photos.length < config.maxPhotos) {
    rows.push([{ text: "➕ Add photo", callback_data: `ef:add:${e.id}` }]);
  }
  rows.push([{ text: "⬅️ Back", callback_data: `edit:${e.id}` }]);
  return { inline_keyboard: rows };
}

/** Show (or update in place) the per-memory field menu. Clears any input step. */
async function showFieldMenu(chatId: number, id: string, messageId?: number): Promise<void> {
  await saveDraft(chatId, { step: "idle", edit_entry_id: null });
  const entry = await getEntryById(id);
  if (!entry) {
    await sendMessage(chatId, "That memory no longer exists. Send /edit to pick another.");
    return;
  }
  const reply_markup = fieldMenu(id);
  if (messageId) await editMessageText(chatId, messageId, entrySummary(entry), { reply_markup });
  else await sendMessage(chatId, entrySummary(entry), { reply_markup });
}

/** Show (or update in place) the photos sub-menu. Clears any input step. */
async function showPhotosMenu(chatId: number, id: string, messageId?: number): Promise<void> {
  await saveDraft(chatId, { step: "idle", edit_entry_id: null });
  const entry = await getEntryById(id);
  if (!entry) {
    await sendMessage(chatId, "That memory no longer exists. Send /edit to pick another.");
    return;
  }
  const text =
    `🖼️ <b>Photos</b> (${entry.photos.length}/${config.maxPhotos})\n` +
    "Tap a photo to remove it, or add a new one.";
  const reply_markup = photosMenu(entry);
  if (messageId) await editMessageText(chatId, messageId, text, { reply_markup });
  else await sendMessage(chatId, text, { reply_markup });
}

async function handleEditPhoto(chatId: number, id: string, photo: TgPhotoSize[]): Promise<void> {
  await sendChatAction(chatId, "upload_photo");
  const largest = photo[photo.length - 1]; // last size = highest resolution
  const filePath = await getFilePath(largest.file_id);
  if (!filePath) {
    await sendMessage(chatId, "⚠️ Couldn't fetch that photo from Telegram. Try sending it again.");
    return;
  }
  const { bytes } = await downloadFile(filePath);
  const ext = filePath.split(".").pop() || "jpg"; // addEntryPhoto normalizes this
  const result = await addEntryPhoto(id, bytes, ext);
  if (!result.ok) {
    await saveDraft(chatId, { step: "idle", edit_entry_id: null });
    if (result.reason === "full") {
      await sendMessage(chatId, `That memory already has ${config.maxPhotos} photos (the max).`);
    } else {
      await sendMessage(chatId, "That memory no longer exists. Send /edit to pick another.");
    }
    return;
  }
  const entry = await getEntryById(id);
  const n = entry?.photos.length ?? 0;
  if (n >= config.maxPhotos) {
    await saveDraft(chatId, { step: "idle", edit_entry_id: null });
    await sendMessage(chatId, `📸 Added — that's the max (${config.maxPhotos}).`);
    await showFieldMenu(chatId, id);
    return;
  }
  // Stay in editing_photos so more can be added one at a time.
  await sendMessage(chatId, `📸 Added (${n}/${config.maxPhotos}). Send another, or tap Done.`, {
    reply_markup: { inline_keyboard: [[{ text: "✅ Done", callback_data: `edit:${id}` }]] },
  });
}

async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  if (chatId == null || messageId == null) {
    await answerCallbackQuery(cb.id);
    return;
  }
  if (!isAllowed(chatId)) {
    await answerCallbackQuery(cb.id, "This is a private journal bot.");
    return;
  }
  await answerCallbackQuery(cb.id); // ack to clear the button spinner
  const data = cb.data ?? "";

  // edit:<id> — show the field menu (also used as the "Back"/"Done adding" target)
  if (data.startsWith("edit:")) {
    await showFieldMenu(chatId, data.slice("edit:".length), messageId);
    return;
  }
  if (data === "ef:close") {
    await saveDraft(chatId, { step: "idle", edit_entry_id: null });
    await editMessageText(
      chatId,
      messageId,
      "✅ <b>Done editing.</b> Send /edit to make more changes.",
    );
    return;
  }

  // ef:<field>:<id> — title | date | desc | photos | add
  const field = data.match(/^ef:(title|date|desc|photos|add):(.+)$/);
  if (field) {
    const [, kind, id] = field;
    if (kind === "photos") {
      await showPhotosMenu(chatId, id, messageId);
      return;
    }
    const entry = await getEntryById(id);
    if (!entry) {
      await sendMessage(chatId, "That memory no longer exists. Send /edit to pick another.");
      return;
    }
    if (kind === "add") {
      if (entry.photos.length >= config.maxPhotos) {
        await showPhotosMenu(chatId, id, messageId);
        return;
      }
      await saveDraft(chatId, { step: "editing_photos", edit_entry_id: id });
      await sendMessage(chatId, `📷 Send a photo to add to "<b>${escapeHtml(entry.title)}</b>".`);
      return;
    }
    const stepByKind = {
      title: "editing_title",
      date: "editing_date",
      desc: "editing_description",
    } as const;
    await saveDraft(chatId, { step: stepByKind[kind as keyof typeof stepByKind], edit_entry_id: id });
    const prompt =
      kind === "title"
        ? "✍️ Send the new <b>title</b>."
        : kind === "date"
          ? "🗓️ Send the new <b>date</b> (e.g. <code>2026-06-30</code>) or /today."
          : "📝 Send the new <b>description</b>, or /clear to remove it.";
    await sendMessage(chatId, prompt);
    return;
  }

  // ef:rm:<id>:<idx> — remove a photo by index
  const rm = data.match(/^ef:rm:(.+):(\d+)$/);
  if (rm) {
    const [, id, idxStr] = rm;
    const entry = await getEntryById(id);
    if (!entry) {
      await sendMessage(chatId, "That memory no longer exists. Send /edit to pick another.");
      return;
    }
    const path = entry.photos[Number(idxStr)];
    if (path) await deleteEntryPhoto(id, path);
    await showPhotosMenu(chatId, id, messageId);
    return;
  }
}

// ── Webhook ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Verify the shared secret Telegram echoes back.
  if (config.telegramWebhookSecret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== config.telegramWebhookSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return ok();
  }

  // Inline-button taps (the edit flow) arrive as callback queries.
  if (update.callback_query) {
    try {
      await handleCallback(update.callback_query);
    } catch (err) {
      console.error("[telegram webhook] callback error", err);
      try {
        await answerCallbackQuery(update.callback_query.id);
      } catch {
        /* ignore */
      }
    }
    return ok();
  }

  const msg = update.message;
  if (!msg) return ok();
  const chatId = msg.chat.id;

  try {
    if (!isAllowed(chatId)) {
      await sendMessage(chatId, "🚫 This is a private journal bot.");
      return ok();
    }

    const text = msg.text?.trim();
    const command =
      text && text.startsWith("/") ? text.split(/\s+/)[0].split("@")[0].toLowerCase() : null;

    // Global commands (work in any state)
    if (command === "/start" || command === "/help") {
      await sendMessage(chatId, helpText(chatId));
      return ok();
    }
    if (command === "/cancel") {
      await clearDraft(chatId, true);
      await sendMessage(chatId, "❌ Discarded. Send /new to start a new memory.");
      return ok();
    }
    if (command === "/new") {
      await clearDraft(chatId, true);
      await saveDraft(chatId, {
        step: "awaiting_title",
        title: null,
        event_date: null,
        description: null,
        photos: [],
      });
      await sendMessage(chatId, "📌 <b>New memory.</b> What's the title?");
      return ok();
    }
    if (command === "/edit") {
      await clearDraft(chatId, true); // discard any half-finished /new draft + its photos
      const entries = await getRecentEntries(10);
      if (!entries.length) {
        await sendMessage(chatId, "You don't have any memories yet. Send /new to add one.");
        return ok();
      }
      const rows = entries.map((e) => [
        {
          text: `${formatShortDate(e.event_date)} · ${e.title}`.slice(0, 60),
          callback_data: `edit:${e.id}`,
        },
      ]);
      await sendMessage(chatId, "✏️ <b>Edit a memory</b>\nPick one to change:", {
        reply_markup: { inline_keyboard: rows },
      });
      return ok();
    }

    const draft = await getDraft(chatId);

    switch (draft.step) {
      case "idle":
        await sendMessage(
          chatId,
          msg.photo
            ? "Send /new first to start a memory, then I'll collect your photos. 📷"
            : "👋 Send /new to add a memory, or /help to see how it works.",
        );
        return ok();

      case "awaiting_title": {
        if (!text || command) {
          await sendMessage(chatId, "Please send the memory's title as text. ✍️");
          return ok();
        }
        await saveDraft(chatId, { title: text.slice(0, 200), step: "awaiting_date" });
        await sendMessage(
          chatId,
          "🗓️ When did it happen?\nSend a date like <code>2026-06-30</code>, or /today.",
        );
        return ok();
      }

      case "awaiting_date": {
        const date = parseDateInput(text ?? "", config.timezone);
        if (!date) {
          await sendMessage(
            chatId,
            "I couldn't read that date. Try <code>2026-06-30</code>, <code>30/06/2026</code>, or /today.",
          );
          return ok();
        }
        await saveDraft(chatId, { event_date: date, step: "awaiting_description" });
        await sendMessage(chatId, "📝 Add a short description, or /skip.");
        return ok();
      }

      case "awaiting_description": {
        const description = command === "/skip" ? null : text && text.length ? text.slice(0, 4000) : null;
        if (command && command !== "/skip") {
          await sendMessage(chatId, "Send a description as text, or /skip.");
          return ok();
        }
        if (!command && !text) {
          await sendMessage(chatId, "Send a description as text, or /skip.");
          return ok();
        }
        await saveDraft(chatId, { description, step: "awaiting_photos" });
        await sendMessage(
          chatId,
          `📷 Send up to ${config.maxPhotos} photos (one by one or as an album).\nThen /done to save — or /done now to save without photos.`,
        );
        return ok();
      }

      case "awaiting_photos": {
        if (command === "/done") {
          await publish(chatId);
          return ok();
        }
        if (msg.photo && msg.photo.length) {
          await handlePhoto(chatId, draft, msg.photo);
          return ok();
        }
        await sendMessage(chatId, "📷 Send a photo, or /done to save this memory.");
        return ok();
      }

      case "editing_title": {
        const id = draft.edit_entry_id;
        if (!id) {
          await sendMessage(chatId, "Send /edit to pick a memory to change.");
          return ok();
        }
        if (!text || command) {
          await sendMessage(chatId, "Please send the new title as text. ✍️");
          return ok();
        }
        await updateEntryTitle(id, text);
        await sendMessage(chatId, "✅ Title updated.");
        await showFieldMenu(chatId, id);
        return ok();
      }

      case "editing_date": {
        const id = draft.edit_entry_id;
        if (!id) {
          await sendMessage(chatId, "Send /edit to pick a memory to change.");
          return ok();
        }
        const date = parseDateInput(text ?? "", config.timezone);
        if (!date) {
          await sendMessage(
            chatId,
            "I couldn't read that date. Try <code>2026-06-30</code>, <code>30/06/2026</code>, or /today.",
          );
          return ok();
        }
        await updateEntryDate(id, date);
        await sendMessage(chatId, `✅ Date updated to ${formatLongDate(date)}.`);
        await showFieldMenu(chatId, id);
        return ok();
      }

      case "editing_description": {
        const id = draft.edit_entry_id;
        if (!id) {
          await sendMessage(chatId, "Send /edit to pick a memory to change.");
          return ok();
        }
        if (command && command !== "/clear") {
          await sendMessage(chatId, "Send a description as text, or /clear to remove it.");
          return ok();
        }
        if (!command && !text) {
          await sendMessage(chatId, "Send a description as text, or /clear to remove it.");
          return ok();
        }
        const description = command === "/clear" ? null : (text ?? "").slice(0, 4000);
        await updateEntryDescription(id, description);
        await sendMessage(chatId, description ? "✅ Description updated." : "✅ Description cleared.");
        await showFieldMenu(chatId, id);
        return ok();
      }

      case "editing_photos": {
        const id = draft.edit_entry_id;
        if (!id) {
          await sendMessage(chatId, "Send /edit to pick a memory to change.");
          return ok();
        }
        if (msg.photo && msg.photo.length) {
          await handleEditPhoto(chatId, id, msg.photo);
          return ok();
        }
        await sendMessage(chatId, "📷 Send a photo to add, or tap Done.", {
          reply_markup: { inline_keyboard: [[{ text: "✅ Done", callback_data: `edit:${id}` }]] },
        });
        return ok();
      }

      default:
        await sendMessage(chatId, "Send /new to add a memory.");
        return ok();
    }
  } catch (err) {
    console.error("[telegram webhook] error", err);
    try {
      await sendMessage(chatId, "⚠️ Something went wrong. Please try again.");
    } catch {
      /* ignore */
    }
    return ok(); // 200 so Telegram doesn't hammer retries
  }
}

// Lightweight health check (does not expose secrets).
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "telegram-webhook",
    configured: Boolean(config.telegramBotToken && config.telegramWebhookSecret),
  });
}
