import type { Metadata } from "next";
import { config } from "@/lib/config";
import { BookOpen } from "@/components/icons";

export const metadata: Metadata = {
  title: `${config.title} — Sign in`,
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/";
  const hasError = sp.error === "1";

  return (
    <main className="lj-desk flex min-h-dvh items-center justify-center px-4 py-10">
      <form
        method="POST"
        action="/api/auth/login"
        className="w-full max-w-sm rounded-2xl border border-paper-edge bg-paper p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
      >
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brown/10 text-brown">
            <BookOpen width={24} height={24} />
          </span>
          <h1 className="font-display text-2xl font-semibold text-ink">{config.title}</h1>
          <p className="mt-1 font-hand text-xl text-brown">{config.subtitle}</p>
        </div>

        <input type="hidden" name="next" value={next} />

        <label className="mt-7 block">
          <span className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Password
          </span>
          <input
            type="password"
            name="password"
            autoFocus
            required
            autoComplete="current-password"
            placeholder="Enter password"
            className="w-full rounded-lg border border-paper-edge bg-white/70 px-3.5 py-2.5 font-body text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>

        {hasError ? (
          <p className="mt-2 font-body text-sm text-[#c0392b]">Incorrect password — try again.</p>
        ) : null}

        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-brown px-4 py-2.5 font-body text-sm font-semibold text-paper transition hover:bg-[#7c3609] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Open the book
        </button>
      </form>
    </main>
  );
}
