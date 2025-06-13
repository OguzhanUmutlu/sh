import {StringTokenValue, Token, tokenize} from "./tokenizer";
import {defaultStderr, FileReader, FileWriter, IO, nullReader, Reader, Writer} from "./stream";
import {Commands} from "./commands";
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

async function runCommandSingle(label: string, args: string[], io: IO) {
    const cmd = Commands[label];
    if (cmd) return cmd.run(args, io);
    io.stderr.write(label + ": command not found\n");
    return 1;
}

async function flattenStringToken(value: StringTokenValue): Promise<string> {
    let text = "";
    for (const part of value) {
        if (typeof part === "string") text += part;
        else if (Array.isArray(part)) {
            const capturedOutput: string[] = [];
            await runCommandFromTokens(part, new IO(nullReader, new Writer(s => capturedOutput.push(s), () => void 0), defaultStderr));
            text += capturedOutput.join("");
        } else if (part.type === "var") text += variables[part.value] ?? "";
        else if (part.type === "word") text += part.value;
    }
    return text;
}

async function runCommandFromTokens(tokens: Token[], io = new IO(), signal: AbortSignal = null): Promise<void> {
    let currentCmdTokens: Token[] = [];
    let lastExitCode = 0;
    let lastPipeValue: string | null = null;

    if (signal.aborted) throw new Error("Aborted");

    const controller = new AbortController();
    signal.addEventListener("abort", () => {
        controller.abort();
    });

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
                    throw new Error("Expected filename after redirection operator");
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
                        throw new Error("Expected filename after input redirection operator");
                    }
                    const filename =
                        next.type === "word" ? next.value : await flattenStringToken(next.value);
                    try {
                        inputRedirect = new FileReader(filename);
                    } catch {
                        throw new Error(`Input redirection file not found: ${filename}`);
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

        const runIO = new IO(inputRedirect ?? nullReader, finalStdout, stderrRedirect);

        const exitCode = await runCommandSingle(label, args, runIO);
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
}

export function runCommand(command: string, io = new IO()) {
    const abort = new AbortController();
    return {abort: () => abort.abort(), wait: () => runCommandFromTokens(tokenize(command), io, abort.signal)};
}