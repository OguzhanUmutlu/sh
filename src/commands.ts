import {fs} from "@zenfs/core";
import {IO, nullReader} from "./stream";
import {chdir, cwd, P, variables} from "./command";
import {setTheme, Themes} from "./theme";

export const Commands: Record<string, { description: string, run: (args: string[], io: IO) => number }> = {
    help: {
        description: "help menu", run(_, io) {
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
        description: "clear the terminal screen", run(_, io) {
            io.stdout.write("\x1b[2J");
            return 0;
        }
    },
    echo: {
        description: "display a line of text", run(args, io) {
            let message = args.join(" ");
            if (io.stdin !== nullReader) message = io.stdin.read().trim() + " " + message;
            io.stdout.write(message.replace("\n", " ") + "\n");
            return 0;
        }
    },
    cat: {
        description: "concatenate files and print on the standard output", run(args, io) {
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
        description: "print lines that match patterns", run(args, io) {
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
            } else if (io.stdin !== nullReader) {
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
        description: "sets a variable", run(args, io) {
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
        description: "list directory contents", run(args, io) {
            const path = args[0] || ".";
            try {
                const files = fs.readdirSync(P(path));
                if (files.length === 0) {
                    return 0;
                } else {
                    io.stdout.write(files.join("\n") + "\n");
                }
            } catch (e) {
                io.stderr.write(`ls: cannot access '${path}': No such file or directory\n`);
                return 1;
            }
            return 0;
        }
    },
    rm: {
        description: "remove files or directories", run(args, io) {
            if (args.length === 0) {
                io.stderr.write("rm: missing operand\n");
                return 1;
            }

            for (const arg of args) {
                try {
                    fs.unlinkSync(P(arg));
                } catch (e) {
                    io.stderr.write(`rm: ${arg}: No such file or directory\n`);
                    return 1;
                }
            }

            return 0;
        }
    },
    cd: {
        description: "change the current directory", run(args, io) {
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
        description: "create directories", run(args, io) {
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
        description: "print the current working directory", run(_, io) {
            io.stdout.write(cwd() + "\n");
            return 0;
        }
    },
    touch: {
        description: "change file timestamps or create empty files", run(args, io) {
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
        description: "change the terminal theme", run(args, io) {
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
    }
};