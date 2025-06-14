import {defineConfig} from "vite";
import path from "path";
import inject from "@rollup/plugin-inject"

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
            buffer: "buffer",
            "@": path.resolve(__dirname, "src"),
        },
    },
    plugins: [
        inject({
            Buffer: ["buffer", "Buffer"]
        })
    ],
    define: {
        global: "globalThis"
    }
});
