import type { MetadataRoute } from "next";

// A personal photo journal — keep it out of search indexes by default.
// (It's still reachable by URL; set a SITE_PASSWORD to gate access.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
