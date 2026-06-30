import { Sprig } from "./icons";

type Props = {
  photos: string[];
  title: string;
  eager?: boolean;
  /** "fill" partitions a fixed-height region (flip-book leaf);
   *  "flow" uses intrinsic photo heights for a flowing document (print/PDF). */
  variant?: "fill" | "flow";
};

/** Photo arrangements for 0–3 photos. Pure/presentational — shared by the
 *  flip-book and the print view. */
export function PhotoCollage({ photos, title, eager = false, variant = "fill" }: Props) {
  const n = photos.length;
  const loading = eager ? "eager" : "lazy";
  const img = (src: string, i: number) => (
    <img src={src} alt={`${title} — photo ${i + 1}`} loading={loading} />
  );

  if (n === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-ink-faint">
        <Sprig width={38} height={38} className="opacity-70" />
        <span className="font-hand text-lg opacity-70">a moment, remembered</span>
      </div>
    );
  }

  // ── Flowing document (print): intrinsic, fixed photo heights so a page never
  //    over- or under-flows regardless of how flex height resolves in print. ──
  if (variant === "flow") {
    if (n === 1) {
      return (
        <div className="w-full">
          <figure className="photo-frame h-[115mm] overflow-hidden" style={{ transform: "rotate(-0.8deg)" }}>
            {img(photos[0], 0)}
          </figure>
        </div>
      );
    }
    if (n === 2) {
      return (
        <div className="flex w-full flex-col gap-4">
          <figure className="photo-frame h-[92mm] overflow-hidden" style={{ transform: "rotate(-0.8deg)" }}>
            {img(photos[0], 0)}
          </figure>
          <figure className="photo-frame h-[92mm] overflow-hidden" style={{ transform: "rotate(0.8deg)" }}>
            {img(photos[1], 1)}
          </figure>
        </div>
      );
    }
    return (
      <div className="flex w-full flex-col gap-4">
        <figure className="photo-frame h-[100mm] overflow-hidden" style={{ transform: "rotate(-0.8deg)" }}>
          {img(photos[0], 0)}
        </figure>
        <div className="grid grid-cols-2 gap-4">
          <figure className="photo-frame h-[60mm] overflow-hidden" style={{ transform: "rotate(0.8deg)" }}>
            {img(photos[1], 1)}
          </figure>
          <figure className="photo-frame h-[60mm] overflow-hidden" style={{ transform: "rotate(-1deg)" }}>
            {img(photos[2], 2)}
          </figure>
        </div>
      </div>
    );
  }

  // ── Fixed-height region (flip-book leaf): cells partition the available
  //    height via flex + object-cover, so the collage always fits the page. ──
  if (n === 1) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-stretch">
        <figure className="photo-frame min-h-0 flex-1 overflow-hidden" style={{ transform: "rotate(-1deg)" }}>
          {img(photos[0], 0)}
        </figure>
      </div>
    );
  }
  if (n === 2) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
        <figure className="photo-frame min-h-0 flex-1 overflow-hidden" style={{ transform: "rotate(-0.8deg)" }}>
          {img(photos[0], 0)}
        </figure>
        <figure className="photo-frame min-h-0 flex-1 overflow-hidden" style={{ transform: "rotate(0.8deg)" }}>
          {img(photos[1], 1)}
        </figure>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      <figure className="photo-frame min-h-0 flex-[1.5] overflow-hidden" style={{ transform: "rotate(-0.8deg)" }}>
        {img(photos[0], 0)}
      </figure>
      <div className="flex min-h-0 flex-1 gap-3">
        <figure className="photo-frame min-h-0 flex-1 overflow-hidden" style={{ transform: "rotate(0.8deg)" }}>
          {img(photos[1], 1)}
        </figure>
        <figure className="photo-frame min-h-0 flex-1 overflow-hidden" style={{ transform: "rotate(-1deg)" }}>
          {img(photos[2], 2)}
        </figure>
      </div>
    </div>
  );
}
