#!/usr/bin/env node
/**
 * Register (or refresh) the Telegram webhook.
 *
 *   node --env-file=.env.local scripts/set-webhook.mjs [https://your-deploy-url]
 *
 * Falls back to NEXT_PUBLIC_SITE_URL when no URL argument is given.
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = (process.argv[2] || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET is not set.");
if (!base || base.startsWith("http://localhost")) {
  throw new Error(
    "Pass a public HTTPS URL, e.g. node --env-file=.env.local scripts/set-webhook.mjs https://your-app.vercel.app",
  );
}

const webhookUrl = `${base}/api/telegram/webhook`;

const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const set = await api("setWebhook", {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ["message"],
  drop_pending_updates: true,
});
console.log("setWebhook →", set);

const info = await api("getWebhookInfo", {});
console.log("getWebhookInfo →", info.result);
