import {fs} from "@zenfs/core";
import {BaseReader, baseStdin, IO} from "./stream";
import {chdir, cwd, cwdFmt, P, variables} from "./command";
import {setTheme, Themes} from "./theme";
import * as git from "isomorphic-git";
import HttpFetch from "isomorphic-git/http/web";
import {print} from "@/renderer";

export type CommandDefinition<T extends string = string> = {
    description: string,
    namedParams?: Record<T, string>,
    shortParams?: Record<string, string>,
    run: (args: string[] & Record<T, boolean>, io: IO) => Promise<number>
};

export const Commands: Record<string, CommandDefinition> = {
    help: {
        description: "help menu", async run(_, io) {
            io.stdout.write("Available commands:\n");
            const names = Object.keys(Commands).sort();
            const maxLength = Math.max(...names.map(name => name.length));
            for (const name of names) {
                io.stdout.write(`  ${name.padEnd(maxLength)} - ${Commands[name].description}\n`);
            }
            return 0;
        }
    },
    clear: {
        description: "clear the terminal screen", async run(_, io) {
            io.stdout.write("\x1b[2J");
            return 0;
        }
    },
    echo: {
        description: "display a line of text",
        shortParams: {n: "no-newline"},
        namedParams: {"no-newline": "do not output the trailing newline"},
        async run(args, io) {
            let message = args.join(" ");
            if (io.stdin !== baseStdin) message = io.stdin.read().trim() + " " + message;
            io.stdout.write(message.replace("\n", " ") + (args["no-newline"] ? "" : "\n"));
            return 0;
        }
    },
    cat: {
        description: "concatenate files and print on the standard output", async run(args, io) {
            if (args.length === 0) {
                io.stderr.write("cat: missing operand\n");
                return 1;
            }

            for (const arg of args) {
                try {
                    const content = fs.readFileSync(P(arg), "utf8");
                    io.stdout.write(content);
                } catch (e) {
                    io.stderr.write(`cat: ${arg}: No such file or directory\n`);
                    return 1;
                }
            }

            return 0;
        }
    },
    grep: {
        description: "print lines that match patterns", async run(args, io) {
            if (args.length < 1) {
                io.stderr.write("grep: usage: grep PATTERN [FILE...]\n");
                return 1;
            }

            const pattern = args[0];
            const files = args.slice(1);
            const regex = new RegExp(pattern);

            if (files.length > 0) {
                for (const file of files) {
                    try {
                        const content = fs.readFileSync(P(file), "utf8");
                        const lines = content.split("\n");
                        for (const line of lines) if (regex.test(line)) io.stdout.write(line + "\n");
                    } catch (e) {
                        io.stderr.write(`grep: ${file}: No such file or directory\n`);
                        return 1;
                    }
                }
            } else if (io.stdin !== baseStdin) {
                const input = io.stdin.read();
                const lines = input.split("\n");
                for (const line of lines) if (regex.test(line)) io.stdout.write(line + "\n");
            } else {
                io.stderr.write("grep: no input provided\n");
                return 1;
            }

            return 0;
        }
    },
    set: {
        description: "sets a variable", async run(args, io) {
            for (const assignment of args) {
                const eq = assignment.indexOf("=");
                if (eq === -1) {
                    io.stderr.write(`set: invalid assignment '${assignment}'\n`);
                    return 1;
                }

                const name = assignment.slice(0, eq);
                variables[name] = assignment.slice(eq + 1);
            }
            return 0;
        }
    },
    ls: {
        description: "list directory contents", shortParams: {"a": "all"},
        namedParams: {"all": "shows hidden files"},
        async run(args, io) {
            const path = args[0] || ".";
            try {
                let files = fs.readdirSync(P(path));
                if (!args.all) {
                    files = files.filter(file => !file.startsWith("."));
                }

                if (files.length === 0) return 0;
                else io.stdout.write(files.join("\n") + "\n");
            } catch (e) {
                io.stderr.write(`ls: cannot access '${path}': No such file or directory\n`);
                return 1;
            }
            return 0;
        }
    },
    rm: {
        description: "remove files or directories",
        shortParams: {r: "recursive", f: "force"},
        namedParams: {
            recursive: "remove directories and their contents recursively",
            force: "ignore nonexistent files and arguments, never prompt"
        }, async run(args, io) {
            if (args.length === 0) {
                io.stderr.write("rm: missing operand\n");
                return 1;
            }

            for (const arg of args) {
                try {
                    const stat = fs.statSync(P(arg));
                    if (stat.isDirectory() && !args.recursive) {
                        io.stderr.write(`rm: cannot remove '${arg}': Is a directory\n`);
                        return 1;
                    }
                    fs.rmSync(P(arg), {recursive: args.recursive, force: args.force});
                } catch (e) {
                    if (P(arg) === "/") return 0;
                    io.stderr.write(`rm: ${arg}: No such file or directory\n`);
                    return 1;
                }
            }

            return 0;
        }
    },
    cd: {
        description: "change the current directory", async run(args, io) {
            if (args.length === 0) args.push("~");
            let path = args[0];
            if (path.startsWith("~")) path = path.replace("~", "/home");
            try {
                chdir(path);
            } catch (e) {
                io.stderr.write(`cd: ${path}: No such file or directory\n`);
                return 1;
            }
            return 0;
        }
    },
    mkdir: {
        description: "create directories", async run(args, io) {
            if (args.length === 0) {
                io.stderr.write("mkdir: missing operand\n");
                return 1;
            }

            for (const arg of args) {
                try {
                    fs.mkdirSync(P(arg), {recursive: true});
                } catch (e) {
                    io.stderr.write(`mkdir: cannot create directory '${arg}'\n`);
                    return 1;
                }
            }

            return 0;
        }
    },
    pwd: {
        description: "print the current working directory",
        shortParams: {f: "format"}, namedParams: {format: "prints the current working directory aligning home as ~"},
        async run(args, io) {
            io.stdout.write((args.format ? cwdFmt() : cwd()) + "\n");
            return 0;
        }
    },
    touch: {
        description: "change file timestamps or create empty files", async run(args, io) {
            if (args.length === 0) {
                io.stderr.write("touch: missing operand\n");
                return 1;
            }

            for (const arg of args) {
                try {
                    fs.writeFileSync(P(arg), "", {flag: "a"});
                } catch (e) {
                    io.stderr.write(`touch: cannot touch '${arg}'\n`);
                    return 1;
                }
            }

            return 0;
        }
    },
    theme: {
        description: "change the terminal theme", async run(args, io) {
            if (args.length === 0) {
                io.stderr.write("theme: missing argument\n");
                return 1;
            }

            const theme = args[0];

            if (theme === "-l") {
                io.stdout.write("Available themes:\n");
                for (const t of Themes) {
                    io.stdout.write(`  theme "${t}"\n`);
                }
                return 0;
            }

            if (!setTheme(theme)) {
                io.stderr.write(`theme: '${theme}' is not a valid theme\n`);
                return 1;
            }

            io.stdout.write(`Theme set to ${theme}\n`);
            return 0;
        }
    },
    chmod: {
        description: "change file mode bits", async run(args, io) {
            if (args.length < 2) {
                io.stderr.write("chmod: missing operand\n");
                return 1;
            }

            let mode = args[0];
            const files = args.slice(1);
            let plus = mode[0] !== "-";
            if (mode[0] === "-" || mode[0] === "+") mode = mode.slice(1);
            const s = {r: 0o400, w: 0o222, x: 0o111, a: 0o777, u: 0o700, g: 0o070, o: 0o007};

            for (let fileO of files) {
                const file = P(fileO);
                let stat: fs.Stats;
                if (!fs.existsSync(file) || !(stat = fs.statSync(file)).isFile()) {
                    io.stderr.write(`chmod: cannot access '${fileO}': No such file or directory\n`);
                    return 1;
                }
                for (const char of mode) {
                    if (s[char]) fs.chmodSync(file, plus ? stat.mode | s[char] : stat.mode & ~s[char]);
                    else {
                        io.stderr.write(`chmod: invalid mode '${mode}'\n`);
                        return 1;
                    }
                }
            }

            return 0;
        }
    },
    github: {
        description: "opens the source code repository on GitHub", async run() {
            open("https://github.com/OguzhanUmutlu/sh");
            return 0;
        }
    },
    git: {
        description: "Git command interface",
        async run(args, io) {
            if (args.length === 0) {
                io.stderr.write("git: missing subcommand\n");
                return 1;
            }

            switch (args[0]) {
                case "clone": {
                    if (args.length < 2) {
                        io.stderr.write("git clone: missing repository URL\n");
                        return 1;
                    }
                    const repoUrl = args[1];
                    const dir = P(args[2] || repoUrl.split("/").pop().replace(/\.git$/, ""));
                    if (fs.existsSync(dir)) {
                        io.stderr.write(`git clone: destination path '${dir}' already exists and is not an empty directory\n`);
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
                        io.stderr.write(`\ngit clone error: ${err.message}\n`);
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
                        io.stderr.write(`\ngit pull error: ${err.message}\n`);
                        return 1;
                    }
                }

                default:
                    io.stderr.write(`git: unknown subcommand '${args[0]}'\n`);
                    return 1;
            }
        }
    },
    vim: {
        description: "text editor", async run(args, io) {
            io.stdout.write("We're no strangers to love\n" +
                "You know the rules and so do I\n" +
                "A full commitment's what I'm thinkin' of\n" +
                "You wouldn't get this from any other guy\n" +
                "I just wanna tell you how I'm feeling\n" +
                "Gotta make you understand\n" +
                "Never gonna give you up, never gonna let you down\n" +
                "Never gonna run around and desert you\n" +
                "Never gonna make you cry, never gonna say goodbye\n" +
                "Never gonna tell a lie and hurt you\n" +
                "We've known each other for so long\n" +
                "Your heart's been aching, but you're too shy to say it\n" +
                "Inside, we both know what's been going on\n" +
                "We know the game and we're gonna play it\n" +
                "And if you ask me how I'm feeling\n" +
                "Don't tell me you're too blind to see\n" +
                "Never gonna give you up, never gonna let you down\n" +
                "Never gonna run around and desert you\n" +
                "Never gonna make you cry, never gonna say goodbye\n" +
                "Never gonna tell a lie and hurt you\n" +
                "Never gonna give you up, never gonna let you down\n" +
                "Never gonna run around and desert you\n" +
                "Never gonna make you cry, never gonna say goodbye\n" +
                "Never gonna tell a lie and hurt you\n" +
                "We've known each other for so long\n" +
                "Your heart's been aching, but you're too shy to say it\n" +
                "Inside, we both know what's been going on\n" +
                "We know the game and we're gonna play it\n" +
                "I just wanna tell you how I'm feeling\n" +
                "Gotta make you understand\n" +
                "Never gonna give you up, never gonna let you down\n" +
                "Never gonna run around and desert you\n" +
                "Never gonna make you cry, never gonna say goodbye\n" +
                "Never gonna tell a lie and hurt you\n" +
                "Never gonna give you up, never gonna let you down\n" +
                "Never gonna run around and desert you\n" +
                "Never gonna make you cry, never gonna say goodbye\n" +
                "Never gonna tell a lie and hurt you\n" +
                "Never gonna give you up, never gonna let you down\n" +
                "Never gonna run around and desert you\n" +
                "Never gonna make you cry, never gonna say goodbye\n" +
                "Never gonna tell a lie and hurt you\n");
            return;
            if (args.length === 0) {
                io.stderr.write("vim: missing file argument\n");
                return 1;
            }

            const file = P(args[0]);
            let content = "";
            if (fs.existsSync(file)) {
                content = fs.readFileSync(file, "utf8");
            }

            io.stdout.write(`Editing ${file}...\n`);
            io.stdout.write(content + "\n");

            io.stdin.open();

            let cmd = null;

            io.stdin.open();

            let res: (v?: unknown) => void;
            const p = new Promise(r => res = r);
            (<BaseReader>io.stdin).cb = function (input: string) {
                if (!input) return;

                if (input === ":") {
                    cmd = "";
                    return;
                }

                if (cmd !== null) {
                    if (input === "\n") {
                        for (const c of cmd) {
                            if (c === "w") {
                                fs.writeFileSync(file, content, "utf8");
                                io.stdout.write(`Saved ${file}\n`);
                            } else if (c === "q") {
                                io.stdin.end();
                                io.stdout.write(`Exiting vim...\n`);
                                res();
                                return;
                            }
                        }
                        cmd = null;
                    } else cmd += input;
                    return;
                }

                print(input);
            }
            await p;

            return 0;
        }
    },
    exit: {
        description: "exit the shell", async run(_, io) {
            io.stdout.write("Exiting...\n");
            io.stdin.open();
            (<BaseReader>io.stdin).cb = () => close();
            await new Promise(() => null);
            return 0;
        }
    }
};