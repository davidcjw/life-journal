import { Sprig } from "./icons";

/** Photo arrangements for 0–3 photos. Pure/presentational — shared by the
 *  flip-book, the print view, and (in spirit) the HTML export. */
export function PhotoCollage({
  photos,
  title,
  eager = false,
}: {
  photos: string[];
  title: string;
  eager?: boolean;
}) {
  const n = photos.length;
  const loading = eager ? "eager" : "lazy";

  if (n === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-ink-faint">
        <Sprig width={38} height={38} className="opacity-70" />
        <span className="font-hand text-lg opacity-70">a moment, remembered</span>
      </div>
    );
  }

  if (n === 1) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <figure
          className="photo-frame w-[86%]"
          style={{ transform: "rotate(-1.4deg)", aspectRatio: "4 / 3" }}
        >
          <img src={photos[0]} alt={`${title} — photo`} loading={loading} />
        </figure>
      </div>
    );
  }

  if (n === 2) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-4">
        {photos.map((p, i) => (
          <figure
            key={i}
            className="photo-frame"
            style={{ transform: `rotate(${i === 0 ? -1.3 : 1.2}deg)`, aspectRatio: "16 / 10" }}
          >
            <img src={p} alt={`${title} — photo ${i + 1}`} loading={loading} />
          </figure>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      <figure className="photo-frame" style={{ transform: "rotate(-1deg)", aspectRatio: "16 / 9" }}>
        <img src={photos[0]} alt={`${title} — photo 1`} loading={loading} />
      </figure>
      <div className="grid grid-cols-2 gap-3">
        <figure className="photo-frame" style={{ transform: "rotate(1.5deg)", aspectRatio: "1 / 1" }}>
          <img src={photos[1]} alt={`${title} — photo 2`} loading={loading} />
        </figure>
        <figure className="photo-frame" style={{ transform: "rotate(-1.7deg)", aspectRatio: "1 / 1" }}>
          <img src={photos[2]} alt={`${title} — photo 3`} loading={loading} />
        </figure>
      </div>
    </div>
  );
}
