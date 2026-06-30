export function Cover({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count?: number;
}) {
  return (
    <div className="lj-cover flex flex-col items-center justify-center px-8 text-center">
      <span className="foil-border foil mb-7 rounded-full border px-3 py-1 font-body text-[0.58rem] font-semibold uppercase tracking-[0.32em]">
        Live Journal
      </span>
      <h1 className="foil font-display text-[2.6rem] font-semibold leading-[1.05]">{title}</h1>
      <p className="mt-4 font-hand text-2xl text-[#ecce97]">{subtitle}</p>
      <div className="foil-border my-7 w-16 border-t" />
      {typeof count === "number" ? (
        <p className="font-body text-[0.62rem] uppercase tracking-[0.28em] text-[#d6bb8c]">
          {count} {count === 1 ? "memory" : "memories"}
        </p>
      ) : null}
    </div>
  );
}

export function BackCover() {
  return (
    <div className="lj-cover flex items-center justify-center">
      <span className="foil-border foil rounded-full border px-5 py-2 font-hand text-xl">
        the end · for now
      </span>
    </div>
  );
}

export function EmptyLeaf({ botUsername }: { botUsername?: string }) {
  const link = botUsername ? `https://t.me/${botUsername}` : null;
  return (
    <div className="lj-page flex flex-col items-center justify-center px-8 text-center">
      <p className="font-hand text-3xl text-brown">your story starts here</p>
      <div className="my-5 h-px w-16 bg-gold/50" />
      <p className="max-w-[15rem] font-body text-sm leading-relaxed text-ink-soft">
        Send your first memory — a date, a few words, and up to three photos — to your
        Telegram bot, and it will appear right here.
      </p>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="lj-btn mt-6"
          style={{ color: "var(--color-ink)" }}
        >
          Open the bot
        </a>
      ) : null}
    </div>
  );
}
