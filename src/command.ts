import {StringTokenValue, Token, tokenize} from "@/tokenizer";
import {baseStdin, defaultStderr, FileReader, FileWriter, IO, Reader, Writer} from "@/stream";
import {Commands} from "@/commands";
import {fs} from "@zenfs/core";
import path from "path";

export const variables: Record<string, string> = {};

let cwdVal = "/";

export function chdir(file: string): void {
    file = P(file);
    if (!fs.statSync(file).isDirectory()) throw new Error("Not a directory");
    cwdVal = file;
}

export function cwd(): string {
    return cwdVal;
}

export function cwdFmt(): string {
    return cwdVal.startsWith("/home") ? cwdVal.replace("/home", "~") : cwdVal;
}

export function P(file: string) {
    return file.startsWith("/") ? file : path.join(cwdVal, file);
}

export const Aliases: Record<string, string> = {};

async function runCommandSingle(label: string, args: string[], io: IO) {
    if (label.startsWith("/") || label.startsWith("./") || label.startsWith("../")) {
        label = P(label);
        if (!fs.existsSync(label)) {
            io.stderr.write(`${label}: no such file or directory\n`);
            return 1;
        }
        if (!fs.statSync(label).isFile()) {
            io.stderr.write(`${label}: is a directory\n`);
            return 1;
        }
        try {
            fs.accessSync(label, fs.constants.X_OK)
        } catch (e) {
            io.stderr.write(`${label}: permission denied\n`);
            return 1;
        }
        return await runBashFile(label, io);
    }
    const params = {};
    if (label in Aliases) label = Aliases[label];
    const cmd = Commands[label];
    if (cmd) {
        if (args.length > 0) {
            let i = 0;
            while (i < args.length) {
                const argO = args[i];
                if (argO === "-h" || argO === "--help") {
                    io.stdout.write(`${label}: ${cmd.description}\n`);
                    if (cmd.namedParams) {
                        io.stdout.write("Options:\n");
                        for (const [param, desc] of Object.entries(cmd.namedParams)) {
                            const short = Object.keys(cmd.shortParams ?? {}).find(key => cmd.shortParams[key] === param);
                            io.stdout.write(`  --${param}${short ? `, -${short}` : ""} - ${desc}\n`);
                        }
                    }
                    return 0;
                }

                let arg = argO;
                if (arg[0] === "-" && arg[1] !== "-") {
                    if (arg[2] === "=") {
                        const val = arg.slice(3);
                        arg = arg[1];
                        if (!cmd.shortParams || !cmd.shortParams[arg]) {
                            io.stderr.write(`${label}: unknown option '${argO}'\n`);
                            return 1;
                        }
                        if (arg in args) {
                            io.stderr.write(`${label}: duplicate option '${argO}'\n`);
                            return 1;
                        }
                        params[cmd.shortParams[arg]] = val;
                        args.splice(i, 1);
                        continue;
                    }
                    for (let char of arg.slice(1)) {
                        if (!cmd.shortParams || !cmd.shortParams[char]) {
                            io.stderr.write(`${label}: unknown option '${argO}'\n`);
                            return 1;
                        }
                        char = cmd.shortParams[char];
                        if (char in args) {
                            io.stderr.write(`${label}: duplicate option '${argO}'\n`);
                            return 1;
                        }
                        params[char] = true;
                    }
                    args.splice(i, 1);
                    continue;
                }
                if (cmd.namedParams && arg.startsWith("--")) {
                    arg = arg.slice(2);
                    let value: true | string = true;
                    if (arg.includes("=")) {
                        const parts = arg.split("=");
                        arg = parts[0];
                        value = parts.slice(1).join("=");
                    }
                    if (arg in cmd.namedParams) {
                        if (arg in args) {
                            io.stderr.write(`${label}: duplicate option '${argO}'\n`);
                            return 1;
                        }
                        params[arg] = value;
                        args.splice(i, 1);
                        continue;
                    }
                }
                i++;
            }
        }

        return await cmd.run(args, params, io);
    }
    io.stderr.write("bash: command not found: " + label + "\n");
    return 1;
}

async function flattenStringToken(value: StringTokenValue): Promise<string> {
    let text = "";
    for (const part of value) {
        if (typeof part === "string") text += part;
        else if (Array.isArray(part)) {
            const capturedOutput: string[] = [];
            const io = new IO(baseStdin, new Writer(s => capturedOutput.push(s), () => void 0), defaultStderr);
            await runCommandFromTokens(part, io);
            io.term.remove();
            text += capturedOutput.join("").trim();
        } else if (part.type === "var") text += variables[part.value] ?? "";
        else if (part.type === "word") text += part.value;
    }
    return text;
}

async function runCommandFromTokens(tokens: Token[], io: IO) {
    let currentCmdTokens: Token[] = [];
    let lastExitCode = 0;
    let lastPipeValue: string | null = null;

    async function runCurrentCommand(extraArgs: string[] = [], shouldCapture: boolean = false): Promise<{
        exitCode: number;
        output: string;
    }> {
        if (currentCmdTokens.length === 0) return {exitCode: lastExitCode, output: ""};

        let label: string | null = null;
        const args: string[] = [...extraArgs];
        let stdoutRedirect = io.stdout;
        let stderrRedirect = io.stderr;
        let inputRedirect: Reader | null = null;

        const capturedOutput: string[] = [];
        const capturingStdout = new Writer(s => capturedOutput.push(s), () => void 0);

        let i = 0;
        while (i < currentCmdTokens.length) {
            const token = currentCmdTokens[i];

            if (token.type === "operator_>") {
                const append = token.value.append;
                const next = currentCmdTokens[i + 1];
                if (!next || (next.type !== "word" && next.type !== "string")) {
                    io.stderr.write("bash: expected filename after '>'\n");
                    return {exitCode: 1, output: ""};
                }

                const filename = next.type === "word" ? next.value : await flattenStringToken(next.value);
                const writer = new FileWriter(filename, append);
                if (token.value.fd === 2) stderrRedirect = writer;
                else if (token.value.fd === 1) stdoutRedirect = writer;

                i += 2;
                continue;
            }

            if (token.type === "operator") {
                if (token.value === "<") {
                    const next = currentCmdTokens[i + 1];
                    if (!next || (next.type !== "word" && next.type !== "string")) {
                        io.stderr.write("bash: expected filename after '<'\n");
                        return {exitCode: 1, output: ""};
                    }
                    const filename = next.type === "word" ? next.value : await flattenStringToken(next.value);
                    try {
                        inputRedirect = new FileReader(filename);
                    } catch {
                        io.stderr.write(`bash: file not found: ${filename}\n`);
                        return {exitCode: 1, output: ""};
                    }
                    i += 2;
                    continue;
                }
            }

            if (!label && token.type === "word") {
                label = token.value;
            } else if (token.type === "string") {
                args.push(await flattenStringToken(token.value));
            } else if (token.type === "word") {
                args.push(token.value);
            } else if (token.type === "var") {
                args.push(variables[token.value] ?? "");
            }

            i++;
        }

        if (!label) return {exitCode: lastExitCode, output: ""};

        const finalStdout = shouldCapture ? capturingStdout : stdoutRedirect;

        const runIO = new IO(inputRedirect ?? baseStdin, finalStdout, stderrRedirect);
        const exitCode = await runCommandSingle(label, args, runIO);
        runIO.term.remove();

        const output = capturedOutput.join("");

        if (!shouldCapture) {
            io.stdout.write(output);
        }

        currentCmdTokens = [];
        return {exitCode, output};
    }

    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];

        if (
            token.type === "operator" &&
            (token.value === "&&" ||
                token.value === "||" ||
                token.value === ";" ||
                token.value === "|")
        ) {
            const extraArgs = lastPipeValue !== null ? [lastPipeValue] : [];
            const shouldCapture = token.value === "|";

            const {exitCode, output} = await runCurrentCommand(extraArgs, shouldCapture);
            lastExitCode = exitCode;
            lastPipeValue = shouldCapture ? output.trim() : null;

            if (token.value !== "|") {
                const shouldRunNext =
                    token.value === ";" ||
                    (token.value === "&&" && exitCode === 0) ||
                    (token.value === "||" && exitCode !== 0);

                if (!shouldRunNext) {
                    currentCmdTokens = [];
                    i++;
                    let token: Token;
                    while (i < tokens.length && !((token = tokens[i]).type === "operator" && ["&&", "||", ";", "|"].includes(token.value))) i++;
                    continue;
                }
            }

            currentCmdTokens = [];
            i++;
        } else {
            currentCmdTokens.push(token);
            i++;
        }
    }

    if (currentCmdTokens.length > 0) {
        const extraArgs = lastPipeValue !== null ? [lastPipeValue] : [];
        await runCurrentCommand(extraArgs, false);
    }

    return lastExitCode;
}

export function runCommand(command: string, io?: IO) {
    const createdIO = !io;
    if (createdIO) io = new IO;
    let tokens: Token[];
    try {
        tokens = tokenize(command);
    } catch (e) {
        io.stderr.write(`bash: ${e.message}\n`);
        if (createdIO) io.term.remove();
        return {
            abort: () => void 0,
            wait: () => Promise.resolve(1),
            exitCode: 1
        };
    }

    const prom = runCommandFromTokens(tokens, io);

    const inst = {
        abort: () => {
            io.term.handler("\x1b{c}c");
            if (createdIO) io.term.remove();
        }, wait: () => prom, exitCode: -1
    };
    prom.then(c => {
        inst.exitCode = c;
        if (createdIO) io.term.remove();
    });
    return inst;
}

export async function runBashFile(file: string, io?: IO) {
    const createdIO = !io;
    if (createdIO) io = new IO;
    const content = fs.readFileSync(file, "utf8");
    let lastExitCode = 0;
    for (const line of content.split("\n")) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith("#")) {
            let tokens: Token[];
            try {
                tokens = tokenize(trimmedLine);
            } catch (e) {
                io.stderr.write(`bash: ${file}: ${e.message}\n`);
                return 0;
            }

            lastExitCode = await runCommandFromTokens(tokens, io);
        }
    }

    if (createdIO) io.term.remove();

    return lastExitCode;
}