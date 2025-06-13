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
        sourcemap: false,
        manifest: false,
        minify: "esbuild",
        rollupOptions: {
            input: path.resolve(__dirname, "src/index.html"),
            output: {
                entryFileNames: `index.js`,
                chunkFileNames: `[name].js`,
                assetFileNames: `[name].[ext]`
            }
        }
    },
    resolve: {
        alias: {
            "path": "path-browserify"
        }
    }
});