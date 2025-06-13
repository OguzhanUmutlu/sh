import {defineConfig} from "vite";
import path from "path";

export default defineConfig({
    root: path.resolve("src"),
    base: "./",
    server: {
        host: "127.0.0.1",
        port: 1923
    },
    build: {
        target: "ES2022",
        assetsDir: ".",
        outDir: path.resolve(__dirname, "dist"),
        emptyOutDir: true,
        rollupOptions: {
            input: path.resolve(__dirname, "src/index.html"),
            external: ["src/server/**"],
            output: {
                entryFileNames: "[name].js",
                chunkFileNames: "[name].js",
                assetFileNames: "[name].[ext]",
                format: "es"
            },
            onwarn(warning, warn) {
                if (warning.code !== "EVAL") warn(warning);
            }
        },
        chunkSizeWarningLimit: 4096
    },
    resolve: {
        alias: {
            "path": "path-browserify"
        }
    }
});