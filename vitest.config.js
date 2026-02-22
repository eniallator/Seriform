import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    watch: false,
    isolate: true,
    passWithNoTests: true,
    environment: "jsdom",
  },
});
