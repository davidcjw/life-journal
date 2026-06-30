import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getServiceClient } from "@/lib/supabase";
import { sendMessage, sendChatAction, getFilePath, downloadFile } from "@/lib/telegram";
import { parseDateInput, formatLongDate } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Step = "idle" | "awaiting_title" | "awaiting_date" | "awaiting_description" | "awaiting_photos";

type Draft = {
  chat_id: number;
  step: Step;
  title: string | null;
  event_date: string | null;
  description: string | null;
  photos: string[];
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
type TgUpdate = { message?: TgMessage };

const ok = () => NextResponse.json({ ok: true });

// ── Draft persistence ────────────────────────────────────────────────────────
async function getDraft(chatId: number): Promise<Draft> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("journal_bot_drafts")
    .select("chat_id,step,title,event_date,description,photos")
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
