import { ImageResponse } from "next/og";

export const ogAlt = "Live Journal — a flip-through digital photo book";
export const ogSize = { width: 1200, height: 630 };

/** Shared renderer for the Open Graph + Twitter card images. */
export function renderOgImage() {
  const title = process.env.JOURNAL_TITLE ?? "Our Journal";
  const subtitle = process.env.JOURNAL_SUBTITLE ?? "A book of moments";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2a221c, #17110d)",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 770,
            height: 472,
            borderRadius: 18,
            color: "#f3e2c0",
            background: "linear-gradient(145deg, #6b3410, #823c10 40%, #5a2c0c)",
            border: "2px solid rgba(231,184,100,0.55)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 20,
              letterSpacing: 10,
              color: "#f0d39a",
              border: "1px solid rgba(231,184,100,0.55)",
              borderRadius: 999,
              padding: "8px 22px",
            }}
          >
            LIVE JOURNAL
          </div>
          <div style={{ display: "flex", fontSize: 86, fontWeight: 700, color: "#fbe7c0", marginTop: 26 }}>
            {title}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#ecce97", marginTop: 12 }}>{subtitle}</div>
          <div style={{ display: "flex", width: 92, height: 2, background: "rgba(231,184,100,0.6)", marginTop: 30 }} />
        </div>
      </div>
    ),
    { ...ogSize },
  );
}
