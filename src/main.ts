import {FG, print, S, scrollToBottom} from "@/renderer";
import {configureSingle, fs} from "@zenfs/core";
import {IndexedDB} from '@zenfs/dom';
import {runBashFile, runCommand, variables} from "@/command";
import {Buffer} from 'buffer'

window.Buffer = Buffer;
console.time("ZenFS:configureSingle");
await configureSingle({backend: IndexedDB});
console.timeEnd("ZenFS:configureSingle");

if (!fs.existsSync("/")) fs.mkdirSync("/");
if (!fs.existsSync("home")) {
    fs.mkdirSync("home");
    fs.writeFileSync("home/.history", "0");
}

const PREFIX = `${FG.green}usr${S.clear}:${FG.blue}$(pwd -f)${FG.purple}$ ${S.clear}`;

if (!fs.existsSync("home/.bashrc")) {
    fs.writeFileSync("home/.bashrc", `echo "${FG.cyan}Welcome to the terminal!${S.clear}"
echo "${FG.yellow}Type 'help' to see a list of commands.${S.clear}"
echo ""
set 'PREFIX=echo -n "${PREFIX.replace("$", "$")}"'
cd /home
`);
}

export async function printPrefix() {
    await runCommand(variables.PREFIX ?? `echo -n "${PREFIX}"`).wait();
}

await runBashFile("home/.bashrc");

await printPrefix();

let commandText = "";
let curIndex = 0;
let replOn = true;
const history = fs.existsSync("home/.history") && fs.statSync("home/.history").isFile()
    ? fs.readFileSync("home/.history", "utf8").split("\n").map(i => i.trim()).filter(Boolean)
    : ["0"];
let historyIndex = +history.shift();
if (isNaN(historyIndex)) {
    history.length = 1;
    history[0] = "";
    historyIndex = 0;
} else if (history.length === 0) {
    history.push("");
    historyIndex = 0;
} else if (historyIndex >= history.length) {
    history.push("");
    historyIndex = history.length - 1;
}

export const stdin = [];

export function openStdin(cb: (input: string) => void) {
    stdin.push(cb);
    return () => {
        const index = stdin.indexOf(cb);
        if (index !== -1) stdin.splice(index, 1);
    };
}

export function closeStdin() {
    stdin.length = 0;
}

const Shortcuts = {
    Backspace: "\b",
    Delete: "\x1b[1C\b",
    Enter: "\n",
    KeyUp: "\x1b[1A",
    KeyDown: "\x1b[1B",
    KeyRight: "\x1b[1C",
    KeyLeft: "\x1b[1D",

    ArrowUp: "\x1b[1A",
    ArrowDown: "\x1b[1B",
    ArrowRight: "\x1b[1C",
    ArrowLeft: "\x1b[1D"
};

export function extractModifiers(input: string) {
    if (/^\x1b\{[sacm]+}/.test(input)) {
        const mod = input.match(/^\x1b\{([sacm]+)}/)?.[1] || "";
        return {
            ctrl: mod.includes("c"),
            alt: mod.includes("a"),
            shift: mod.includes("s"),
            meta: mod.includes("m"),
            input: input.slice(mod.length + 3),
            hasModifier: true
        };
    }

    return {
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
        input,
        hasModifier: false
    };
}

async function terminalInput(input: string, e: KeyboardEvent) {
    const mod = extractModifiers(input);
    const {ctrl, alt, shift, meta, hasModifier} = mod;
    input = mod.input;

    if (input === Shortcuts.Enter) {
        if (hasModifier) return;
        print("\n");
        if (!commandText.trim()) return await printPrefix();
        replOn = false;
        if (historyIndex !== 0 && history[historyIndex - 1] === commandText.trim()) {
            history[historyIndex] = "";
        } else {
            history.length = historyIndex + 1;
            history.push("");
            historyIndex++;
            if (fs.existsSync("home/.history") && fs.statSync("home/.history").isFile()) {
                let rm = history.length - 100;
                if (rm > 0) {
                    history.splice(100, rm);
                    historyIndex = Math.max(0, historyIndex - rm);
                }
                fs.writeFileSync("home/.history", historyIndex + "\n" + history.join("\n"));
            }
        }
        scrollToBottom();
        await runCommand(commandText.trim()).wait();
        commandText = "";
        curIndex = 0;
        await printPrefix();
        replOn = true;
        stdin.length = 0;
        return;
    }
    if (input === Shortcuts.Backspace) {
        if (hasModifier || curIndex <= 0) return;
        print("\b");
        curIndex--;
        commandText = commandText.slice(0, curIndex) + commandText.slice(curIndex + 1);
        if (historyIndex === history.length - 1) history[historyIndex] = commandText;
        return;
    }
    if (input === Shortcuts.Delete) {
        if (hasModifier || curIndex >= commandText.length) return;
        print("\x1b[1C\b");
        commandText = commandText.slice(0, curIndex) + commandText.slice(curIndex + 1);
        if (historyIndex === history.length - 1) history[historyIndex] = commandText;
        return;
    }
    if (input === Shortcuts.KeyLeft || input === Shortcuts.KeyRight) {
        const left = input === Shortcuts.KeyLeft;
        if (hasModifier || (left && curIndex <= 0) || (!left && curIndex >= commandText.length)) return;
        print(input);
        curIndex += left ? -1 : 1;
        return;
    }
    if (input === Shortcuts.KeyUp || input === Shortcuts.KeyDown) {
        const up = input === Shortcuts.KeyUp;
        if (hasModifier || (up && historyIndex === 0) || (!up && historyIndex === history.length - 1)) return;
        historyIndex += up ? -1 : 1;
        print("\x1b[2K");
        await printPrefix();
        print(history[historyIndex]);
        curIndex = history[historyIndex].length;
        commandText = history[historyIndex];
        return;
    }

    if (hasModifier) {
        if (input === "l") {
            print("\x1b[2J");
            await printPrefix();
            e.preventDefault();
            return;
        }
        if (input === "c") {
            print("\n");
            commandText = "";
            curIndex = 0;
            await printPrefix();
            return;
        }
        return;
    }

    print(input);
    commandText = commandText.slice(0, curIndex) + input + commandText.slice(curIndex);
    if (historyIndex === history.length - 1) history[historyIndex] = commandText;
    curIndex++;
}

addEventListener("keydown", async e => {
    let key = e.key;

    if (key.length !== 1 && !(key in Shortcuts)) return;

    if (key in Shortcuts) key = Shortcuts[key];

    if (e.ctrlKey || e.altKey || e.metaKey) {
        key = key.toLowerCase();
        let mod = "\x1b{";
        if (e.shiftKey) mod += "s";
        if (e.altKey) mod += "a";
        if (e.ctrlKey) mod += "c";
        if (e.metaKey) mod += "m";
        mod += "}";
        key = mod + key;
    }

    if (replOn) await terminalInput(key, e);
    else for (const cb of stdin) cb(key);
});
