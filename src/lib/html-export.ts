import { formatLongDate, monthLabel } from "./dates";

export type ExportEntry = {
  event_date: string;
  title: string;
  description: string | null;
  photoDataUris: string[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function frame(src: string, rot: number, ratio: string, alt: string): string {
  return `<figure class="frame" style="transform:rotate(${rot}deg);aspect-ratio:${ratio}"><img src="${src}" alt="${esc(
    alt,
  )}"/></figure>`;
}

function collage(photos: string[], title: string): string {
  if (photos.length === 0) return `<div class="empty">a moment, remembered</div>`;
  if (photos.length === 1)
    return `<div class="collage one">${frame(photos[0], -1.4, "4/3", title)}</div>`;
  if (photos.length === 2)
    return `<div class="collage two">${frame(photos[0], -1.3, "16/10", title)}${frame(
      photos[1],
      1.2,
      "16/10",
      title,
    )}</div>`;
  return `<div class="collage three"><div class="big">${frame(
    photos[0],
    -1,
    "16/9",
    title,
  )}</div><div class="row">${frame(photos[1], 1.5, "1/1", title)}${frame(
    photos[2],
    -1.7,
    "1/1",
    title,
  )}</div></div>`;
}

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--paper:#fffaf2;--paper2:#fef5e9;--edge:#ecdfcd;--ink:#2c2219;--soft:#786755;--faint:#a8927a;--brown:#92400e;--gold:#a16207;--desk:#241d18}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Nunito Sans',ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:var(--desk);padding:48px 16px;line-height:1.5}
.cover{max-width:720px;margin:0 auto 28px;padding:64px 40px;text-align:center;border-radius:10px;color:#f4e3c4;background:linear-gradient(145deg,#6b3410,#823c10 40%,#5a2c0c);box-shadow:0 20px 50px rgba(0,0,0,.45)}
.cover .kicker{display:inline-block;border:1px solid rgba(231,184,100,.6);border-radius:999px;padding:5px 14px;font-size:11px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:#f0d39a}
.cover h1{font-family:'Fraunces',Georgia,serif;font-size:44px;font-weight:600;margin:22px 0 8px;color:#fbe7c0}
.cover .sub{font-family:'Caveat',cursive;font-size:30px;color:#ecce97}
.cover-rule{width:64px;height:1px;background:rgba(231,184,100,.6);margin:24px auto}
.cover .count{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:#d6bb8c}
main{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
.page{position:relative;background:linear-gradient(180deg,var(--paper),var(--paper2));border:1px solid var(--edge);border-radius:8px;padding:40px 44px;box-shadow:0 10px 30px rgba(0,0,0,.28)}
.page header{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.page .date{font-family:'Caveat',cursive;font-size:30px;line-height:1;color:var(--brown)}
.page .month{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--faint);white-space:nowrap}
.page h2{font-family:'Fraunces',Georgia,serif;font-size:30px;font-weight:600;line-height:1.15;margin-top:10px;color:var(--ink)}
.rule{width:56px;height:1px;background:rgba(161,98,7,.5);margin:12px 0 4px}
.desc{font-size:16px;color:var(--soft);margin:8px 0 18px;max-width:60ch}
.collage{display:flex;flex-direction:column;gap:14px;margin-top:6px}
.collage.two{gap:16px}
.frame{background:#fffdf9;padding:8px;border-radius:3px;border:1px solid rgba(44,34,25,.06);box-shadow:0 1px 1px rgba(44,34,25,.12),0 12px 22px rgba(44,34,25,.16);overflow:hidden}
.frame img{display:block;width:100%;height:100%;object-fit:cover;border-radius:1px}
.collage.three .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.empty{font-family:'Caveat',cursive;font-size:22px;color:var(--faint);text-align:center;padding:32px 0}
.page-num{position:absolute;bottom:16px;right:24px;font-size:11px;letter-spacing:.2em;color:var(--faint)}
.doc-foot{max-width:720px;margin:30px auto 0;text-align:center;font-size:12px;letter-spacing:.06em;color:#9a866e}
@media print{
  @page{size:A4;margin:14mm}
  body{background:#fff;padding:0}
  .cover,.page{box-shadow:none;break-inside:avoid}
  .cover{page-break-after:always}
  .page{page-break-inside:avoid;margin:0}
  main{gap:0}
}
`;

export function buildExportHtml({
  title,
  subtitle,
  entries,
  generatedAt,
}: {
  title: string;
  subtitle: string;
  entries: ExportEntry[];
  generatedAt: string;
}): string {
  const pages =
    entries
      .map(
        (e, i) => `<article class="page">
  <header><p class="date">${esc(formatLongDate(e.event_date))}</p><span class="month">${esc(
    monthLabel(e.event_date),
  )}</span></header>
  <h2>${esc(e.title)}</h2>
  <div class="rule"></div>
  ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ""}
  ${collage(e.photoDataUris, e.title)}
  <span class="page-num">${i + 1}</span>
</article>`,
      )
      .join("\n") ||
    `<article class="page"><h2>Your story starts here</h2><p class="desc">Add your first memory through the Telegram bot and it will appear in your book.</p></article>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head>
<body>
<section class="cover">
  <span class="kicker">Live Journal</span>
  <h1>${esc(title)}</h1>
  <p class="sub">${esc(subtitle)}</p>
  <div class="cover-rule"></div>
  <p class="count">${entries.length} ${entries.length === 1 ? "memory" : "memories"}</p>
</section>
<main>${pages}</main>
<p class="doc-foot">Exported ${esc(generatedAt)} · ${esc(title)}</p>
</body>
</html>`;
}
