import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Match the Next.js "@/*" -> "src/*" path mapping from tsconfig.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a Next.js guard module that throws outside a server
      // bundle; stub it out so server libs can be imported under Node/Vitest.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
