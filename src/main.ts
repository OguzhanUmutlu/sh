import {FG, print, S, scrollToBottom} from "./renderer";
import {configureSingle, fs} from "@zenfs/core";
import {IndexedDB} from '@zenfs/dom';
import {runBashFile, runCommand, variables} from "./command";
import {setTheme} from "./theme";
import {Buffer} from 'buffer'

window.Buffer = Buffer;
await configureSingle({backend: IndexedDB});

setTheme("Catppuccin Mocha");

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

async function printPrefix() {
    await runCommand(variables.PREFIX ?? `echo -n "${PREFIX}"`).wait();
}

await runBashFile("home/.bashrc");

await printPrefix();

let commandText = "";
let curIndex = 0;
let allowInput = true;
let stdinOn = true;
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
    stdinOn = true;
    return () => {
        const index = stdin.indexOf(cb);
        if (index !== -1) stdin.splice(index, 1);
    };
}

export function closeStdin() {
    stdinOn = false;
    stdin.length = 0;
}

const Shortcuts = {
    "CTRL+V"() {
    },
    async "CTRL+L"() {
        if (!stdinOn || !allowInput) return;
        print("\x1b[2J");
        await printPrefix();
    },
    async Enter() {
        for (const cb of stdin) cb("\n");
        if (!stdinOn || !allowInput) return;
        print("\n");
        if (!commandText.trim()) return await printPrefix();
        allowInput = false;
        stdinOn = false;
        if (historyIndex !== 0 && history[historyIndex - 1] === commandText.trim()) {
            history[historyIndex] = "";
        } else {
            history.length = historyIndex + 1;
            history.push("");
            historyIndex++;
            if (fs.existsSync("home/.history") && fs.statSync("home/.history").isFile()) {
                fs.writeFileSync("home/.history", historyIndex + "\n" + history.join("\n"));
            }
        }
        scrollToBottom();
        await runCommand(commandText.trim()).wait();
        commandText = "";
        curIndex = 0;
        await printPrefix();
        allowInput = true;
        stdinOn = true;
        stdin.length = 0;
    },
    Backspace() {
        for (const cb of stdin) cb("\b");
        if (!stdinOn || !allowInput || curIndex <= 0) return;
        print("\b");
        curIndex--;
        commandText = commandText.slice(0, curIndex) + commandText.slice(curIndex + 1);
        if (historyIndex === history.length - 1) history[historyIndex] = commandText;
    },
    Delete() {
        for (const cb of stdin) cb("\x1b[1C\b");
        if (!stdinOn) return;
        if (!allowInput) return print("\x1b[1C\b");
        if (curIndex >= commandText.length) return;
        print("\x1b[1C\b");
        commandText = commandText.slice(0, curIndex) + commandText.slice(curIndex + 1);
        if (historyIndex === history.length - 1) history[historyIndex] = commandText;
    },
    KeyLeft() {
        for (const cb of stdin) cb("\x1b[1D");
        if (stdinOn) return;
        if (!allowInput || curIndex <= 0) return;
        print("\x1b[1D");
        curIndex--;
    },
    KeyRight() {
        for (const cb of stdin) cb("\x1b[1C");
        if (stdinOn) return;
        if (!allowInput || curIndex >= commandText.length) return;
        print("\x1b[1C");
        curIndex++;
    },
    async KeyUp() {
        for (const cb of stdin) cb("\x1b[1A");
        if (stdinOn) return;
        if (!allowInput || historyIndex === 0) return;
        historyIndex--;
        print("\x1b[2K");
        await printPrefix();
        print(history[historyIndex]);
        curIndex = history[historyIndex].length;
        commandText = history[historyIndex];
    },
    async KeyDown() {
        for (const cb of stdin) cb("\x1b[1B");
        if (stdinOn) return;
        if (!allowInput || historyIndex === history.length - 1) return;
        historyIndex++;
        print("\x1b[2K");
        await printPrefix();
        print(history[historyIndex]);
        curIndex = history[historyIndex].length;
        commandText = history[historyIndex];
    },
    ArrowLeft: () => Shortcuts.KeyLeft(),
    ArrowRight: () => Shortcuts.KeyRight(),
    ArrowUp: () => Shortcuts.KeyUp(),
    ArrowDown: () => Shortcuts.KeyDown()
};

addEventListener("keydown", async e => {
    if (e.key.length === 1) {
        if (!stdinOn) return;
        if (e.ctrlKey || e.altKey || e.metaKey) {
            let key = e.key.toUpperCase();
            if (e.shiftKey) key = "SHIFT+" + key;
            if (e.altKey) key = "ALT+" + key;
            if (e.ctrlKey) key = "CTRL+" + key;
            if (e.metaKey) key = "META+" + key;
            if (key in Shortcuts) {
                Shortcuts[key](e);
                e.preventDefault();
            }
            return;
        }

        for (const cb of stdin) cb(e.key);
        if (!allowInput) return;
        print(e.key);
        commandText = commandText.slice(0, curIndex) + e.key + commandText.slice(curIndex);
        if (historyIndex === history.length - 1) history[historyIndex] = commandText;
        curIndex++;
    } else if (e.key in Shortcuts) {
        Shortcuts[e.key](e);
        e.preventDefault();
    }
});
