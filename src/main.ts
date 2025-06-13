import {FG, print, println, S, scrollToBottom} from "./renderer";
import {configureSingle} from "@zenfs/core";
import {IndexedDB} from '@zenfs/dom';
import {cwdFmt, runCommand} from "./command";
import {setTheme} from "./theme";

await configureSingle({backend: IndexedDB});

setTheme("Catppuccin Mocha");

println(FG.cyan + "Welcome to the terminal!");
println(FG.yellow + "Type `help` to see a list of commands.");
println("");

function printPrefix() {
    print(`${FG.green}usr${S.clear}:${FG.blue}${cwdFmt()}${FG.purple}$ ${S.clear}`);
}

await runCommand("mkdir home").wait();
await runCommand("cd home").wait();

printPrefix();

let commandText = "";
let curIndex = 0;
let allowInput = true;
let stdinOn = true;
const history = [""];
let historyIndex = 0;

const Shortcuts = {
    "CTRL+V"() {
    },
    "CTRL+L"() {
        if (!stdinOn) return;
        print("\x1b[2J");
        printPrefix();
    },
    async Enter() {
        if (!stdinOn) return;
        print("\n");
        if (!allowInput) return;
        allowInput = false;
        stdinOn = false;
        history.push("");
        scrollToBottom();
        await runCommand(commandText).wait();
        commandText = "";
        curIndex = 0;
        printPrefix();
        allowInput = true;
        stdinOn = true;
    },
    Backspace() {
        if (!stdinOn) return;
        if (!allowInput) return print("\b");
        if (curIndex <= 0) return;
        print("\b");
        curIndex--;
        commandText = commandText.slice(0, curIndex) + commandText.slice(curIndex + 1);
        if (historyIndex === history.length - 1) history[historyIndex] = commandText;
    },
    Delete() {
        if (!stdinOn) return;
        if (!allowInput) return print("\x1b[1C\b");
        if (curIndex >= commandText.length) return;
        commandText = commandText.slice(0, curIndex) + commandText.slice(curIndex + 1);
        if (historyIndex === history.length - 1) history[historyIndex] = commandText;
    },
    KeyLeft() {
        if (!stdinOn || !allowInput || curIndex <= 0) return;
        print("\x1b[1D");
        curIndex--;
    },
    KeyRight() {
        if (!stdinOn || !allowInput || curIndex >= commandText.length) return;
        print("\x1b[1C");
        curIndex++;
    },
    KeyUp() {
        if (!stdinOn || !allowInput || historyIndex === 0) return;
        historyIndex--;
        print("\f" + "\b".repeat(commandText.length) + history[historyIndex]);
        curIndex = history[historyIndex].length;
    },
    KeyDown() {
        if (!stdinOn || !allowInput || historyIndex === history.length - 1) return;
        historyIndex++;
        print("\f" + "\b".repeat(commandText.length) + history[historyIndex]);
        curIndex = history[historyIndex].length;
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
                Shortcuts[key]();
                e.preventDefault();
            }
            return;
        }

        print(e.key);
        if (!allowInput) return;
        commandText = commandText.slice(0, curIndex) + e.key + commandText.slice(curIndex);
        if (historyIndex === history.length - 1) history[historyIndex] = commandText;
        curIndex++;
    } else if (e.key in Shortcuts) {
        Shortcuts[e.key]();
        e.preventDefault();
    }
});
