import {canvas, CTRL, extractModifiers, FG, print, S} from "@/renderer";
import {configureSingle, fs} from "@zenfs/core";
import {IndexedDB} from '@zenfs/dom';
import {runBashFile, runCommand, variables} from "@/command";
import {Buffer} from 'buffer'
import {baseStdin} from "@/stream";

window.Buffer = Buffer;
console.time("ZenFS:configureSingle");
await configureSingle({backend: IndexedDB});
console.timeEnd("ZenFS:configureSingle");

if (!fs.existsSync("/")) fs.mkdirSync("/");
if (!fs.existsSync("home")) {
    fs.mkdirSync("home");
    fs.writeFileSync("home/.history", "0");
}

const PREFIX = `${FG.green}usr${S.reset}:${FG.blue}$(pwd -f)${FG.purple}$ ${S.reset}`;

if (!fs.existsSync("home/.bashrc")) {
    fs.writeFileSync("home/.bashrc", `echo "${FG.cyan}Welcome to the terminal!${S.reset}"
echo "${FG.yellow}Type 'help' to see a list of commands.${S.reset}"
echo ""
cd
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

const Shortcuts = {
    Backspace: CTRL.backspace,
    Delete: CTRL.delete,
    Enter: "\n",
    KeyUp: CTRL.cursorUp(1),
    KeyDown: CTRL.cursorDown(1),
    KeyRight: CTRL.cursorRight(1),
    KeyLeft: CTRL.cursorLeft(1),
    Home: CTRL.home,
    End: CTRL.end,
    Escape: CTRL.escape,

    ArrowUp: CTRL.cursorUp(1),
    ArrowDown: CTRL.cursorDown(1),
    ArrowRight: CTRL.cursorRight(1),
    ArrowLeft: CTRL.cursorLeft(1)
};

function countCtrlLeft() {
    for (let i = curIndex - 1; i >= 0; i--) {
        if (commandText[i] === " ") return curIndex - i;
        if (i === 0) return curIndex;
    }
    return 0;
}

function countCtrlRight() {
    for (let i = curIndex; i < commandText.length; i++) {
        if (commandText[i] === " ") return i - curIndex + 1;
        if (i === commandText.length - 1) return commandText.length - curIndex;
    }
    return 0;
}

async function terminalInput(input: string, e: Event) {
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
            const isBack = historyIndex === history.length - 1;
            history.length = historyIndex + 1;
            if (!isBack) {
                history.push(commandText);
                historyIndex++;
            }

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
        await runCommand(commandText.trim()).wait();
        commandText = "";
        curIndex = 0;
        await printPrefix();
        replOn = true;
        baseStdin.callbacks.length = 0;
        return;
    } else if (input === Shortcuts.Backspace) {
        if (curIndex <= 0) return;
        if (ctrl) {
            const len = countCtrlLeft();
            print("\b".repeat(len));
            commandText = commandText.slice(0, curIndex - len) + commandText.slice(curIndex);
            curIndex -= len;
            if (historyIndex === history.length - 1) history[historyIndex] = commandText;
            return;
        }
        print("\b");
        curIndex--;
        commandText = commandText.slice(0, curIndex) + commandText.slice(curIndex + 1);
        if (historyIndex === history.length - 1) history[historyIndex] = commandText;
        return;
    } else if (input === Shortcuts.Delete) {
        if (curIndex >= commandText.length) return;
        if (ctrl) {
            const len = countCtrlRight();
            print(CTRL.cursorRight(len) + CTRL.backspace.repeat(len));
            commandText = commandText.slice(0, curIndex) + commandText.slice(curIndex + len);
            if (historyIndex === history.length - 1) history[historyIndex] = commandText;
            return;
        }
        print(input);
        commandText = commandText.slice(0, curIndex) + commandText.slice(curIndex + 1);
        if (historyIndex === history.length - 1) history[historyIndex] = commandText;
        return;
    } else if (input === Shortcuts.KeyLeft || input === Shortcuts.KeyRight) {
        const left = input === Shortcuts.KeyLeft;
        if ((left && curIndex <= 0) || (!left && curIndex >= commandText.length)) return;
        let len = 1;
        if (ctrl) {
            len = left ? countCtrlLeft() : countCtrlRight();
            if (!len) return;
        }
        print(input.replace("1", len.toString()));
        curIndex += left ? -len : len;
        return;
    } else if (input === Shortcuts.KeyUp || input === Shortcuts.KeyDown) {
        const up = input === Shortcuts.KeyUp;
        if (hasModifier || (up && historyIndex === 0) || (!up && historyIndex === history.length - 1)) return;
        historyIndex += up ? -1 : 1;
        print(CTRL.clearLine);
        await printPrefix();
        print(history[historyIndex]);
        curIndex = history[historyIndex].length;
        commandText = history[historyIndex];
        return;
    } else if (input === Shortcuts.Home || input === Shortcuts.End) {
        if (hasModifier) return;
        if (input === Shortcuts.Home) {
            if (!curIndex) return;
            print(CTRL.cursorLeft(curIndex));
            curIndex = 0;
        } else {
            if (curIndex >= commandText.length) return;
            print(CTRL.cursorRight(commandText.length - curIndex + 1));
            curIndex = commandText.length;
        }
        return;
    }

    if (hasModifier) {
        if (ctrl && input === "l") {
            print(CTRL.clear);
            await printPrefix();
            e.preventDefault();
            return;
        }
        if (ctrl && input === "c") {
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
    curIndex += input.length;
}

async function onKeyDown(e: KeyboardEvent) {
    let key = e.key;

    if (key.length !== 1 && !(key in Shortcuts)) return;

    if (key in Shortcuts) key = Shortcuts[key];

    if (e.ctrlKey || e.altKey || e.metaKey) {
        let mod = "\x1b{";
        if (e.shiftKey) mod += "s";
        if (e.altKey) mod += "a";
        if (e.ctrlKey) mod += "c";
        if (e.metaKey) mod += "m";
        mod += "}";
        key = mod + key;
    }

    if (replOn) await terminalInput(key, e);
    else for (const cb of baseStdin.callbacks) cb(key);
}

addEventListener("keydown", onKeyDown);

const input = document.querySelector("input");
canvas.addEventListener("click", () => {
    if (innerWidth < innerHeight) input.focus();
});
input.addEventListener("input", async e => {
    const val = input.value;
    if (!val) {
        await onKeyDown(new KeyboardEvent("keydown", {
            key: "Backspace",
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false
        }));
        return;
    }
    terminalInput(val.slice(1), e).then(r => r);
    input.value = " ";
});
addEventListener("paste", async e => {
    e.preventDefault();
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    if (!clipboardData) return;

    const text = clipboardData.getData("text");
    if (!text) return;

    for (const char of text) {
        await terminalInput(char, e);
    }
});