import {CommandDefinition} from "@/commands";
import {P} from "@/command";
import {fs} from "@zenfs/core";
import * as git from "isomorphic-git";
import HttpFetch from "isomorphic-git/http/web";

export default <CommandDefinition>{
    description: "Git command interface",
    async run(args, params, io) {
        if (args.length === 0) {
            io.stderr.write("git: missing subcommand\n");
            return 1;
        }

        switch (args[0]) {
            case "clone": {
                if (args.length < 2) {
                    io.stderr.write("git: missing repository URL\n");
                    return 1;
                }
                const repoUrl = args[1];
                const dir = P(args[2] || repoUrl.split("/").pop().replace(/\.git$/, ""));
                if (fs.existsSync(dir)) {
                    io.stderr.write(`git: destination path '${dir}' already exists and is not an empty directory\n`);
                    return 1;
                }
                io.stdout.write(`Cloning ${repoUrl} into ${dir}...`);
                let lastPhase: string;
                try {
                    await git.clone({
                        fs,
                        http: HttpFetch,
                        dir,
                        url: repoUrl,
                        corsProxy: "https://cors.isomorphic-git.org",
                        singleBranch: true,
                        depth: 1,
                        onProgress: (progress) => {
                            const {phase, loaded, total} = progress;
                            const percent = total ? ((loaded / total) * 100).toFixed(1) : "??";
                            io.stdout.write(`${lastPhase === phase ? "\x1b[2K" : "\n"}  [${percent}%] ${phase}`);
                            lastPhase = phase;
                        }
                    });
                    io.stdout.write(`\nCloned ${repoUrl} into ${dir}\n`);
                    return 0;
                } catch (err) {
                    io.stderr.write(`\ngit: ${err.message}\n`);
                    return 1;
                }
            }
            case "pull": {
                const dir = P(args[1] || ".");
                io.stdout.write(`Pulling latest changes into ${dir}...`);
                let lastPhase: string;
                try {
                    await git.pull({
                        fs,
                        http: HttpFetch,
                        dir,
                        corsProxy: "https://cors.isomorphic-git.org",
                        singleBranch: true,
                        onProgress: (progress) => {
                            const {phase, loaded, total} = progress;
                            const percent = total ? ((loaded / total) * 100).toFixed(1) : "??";
                            io.stdout.write(`${lastPhase === phase ? "\x1b[2K" : "\n"}  [${percent}%] ${phase}`);
                            lastPhase = phase;
                        }
                    });
                    io.stdout.write(`\nPulled latest changes into ${dir}\n`);
                    return 0;
                } catch (err) {
                    io.stderr.write(`\ngit: ${err.message}\n`);
                    return 1;
                }
            }

            default:
                io.stderr.write(`git: unknown subcommand '${args[0]}'\n`);
                return 1;
        }
    }
};