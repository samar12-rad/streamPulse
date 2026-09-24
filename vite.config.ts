/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  css: {
    modules: { localsConvention: "camelCaseOnly" },
  },
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks cache independently of app code. Charting is
        // the bulk of the bundle, so it gets its own chunk.
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            {
              name: "charts",
              test: /node_modules[\\/](recharts|d3-|victory-vendor|es-toolkit|immer|reselect|@reduxjs|react-redux|redux)/,
              priority: 20,
            },
            { name: "vendor", test: /node_modules/, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
