import { config } from "./config";

const base = () => `https://api.telegram.org/bot${config.telegramBotToken}`;

type TgResult<T> = { ok: boolean; result?: T; description?: string };

async function call<T>(method: string, body: Record<string, unknown>): Promise<TgResult<T>> {
  const res = await fetch(`${base()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as TgResult<T>;
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

export async function sendChatAction(chatId: number | string, action = "upload_photo"): Promise<void> {
  await call("sendChatAction", { chat_id: chatId, action });
}

/** Acknowledge a tapped inline button (clears its loading spinner). */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

/** Edit an existing message in place (used to swap inline-keyboard menus). */
export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

/** Resolve a Telegram file_id to a temporary file_path. */
export async function getFilePath(fileId: string): Promise<string | null> {
  const r = await call<{ file_path?: string }>("getFile", { file_id: fileId });
  return r.ok ? (r.result?.file_path ?? null) : null;
}

/** Download a Telegram file by its file_path. */
export async function downloadFile(
  filePath: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(`https://api.telegram.org/file/bot${config.telegramBotToken}/${filePath}`);
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, contentType };
}
