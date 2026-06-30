import { renderOgImage, ogAlt, ogSize } from "@/lib/og";

export const runtime = "nodejs";
export const alt = ogAlt;
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOgImage();
}
