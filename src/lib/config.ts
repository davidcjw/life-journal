/**
 * Centralized runtime config. Server-only values (service role key, bot token,
 * webhook secret) must NEVER be referenced from a client component — this module
 * is only imported by server code.
 */
export const config = {
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  photosBucket: process.env.SUPABASE_PHOTOS_BUCKET ?? "journal-photos",

  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  allowedChatIds: (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Site
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, ""),
  sitePassword: process.env.SITE_PASSWORD ?? "",
  title: process.env.JOURNAL_TITLE ?? "Our Journal",
  subtitle: process.env.JOURNAL_SUBTITLE ?? "A book of moments",
  timezone: process.env.JOURNAL_TIMEZONE ?? "Asia/Singapore",
  botUsername: (process.env.JOURNAL_BOT_USERNAME ?? "").replace(/^@/, ""),

  // Limits
  maxPhotos: 3,
} as const;

export function assertSupabaseConfigured() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
}
