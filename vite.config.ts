import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    root: "src",
    base: "./",
    build: {
        outDir: "../dist",
        emptyOutDir: true,
        target: "esnext",
    },
    resolve: {
        alias: {
            path: "path-browserify",
            "@": path.resolve(__dirname, "src"),
        },
    },
});
