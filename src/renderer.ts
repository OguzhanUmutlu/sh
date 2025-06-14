import {ansi256ToRgb} from "./utils";
import {getTheme, setTheme} from "./theme";

type Div = HTMLDivElement;
type Canvas = HTMLCanvasElement;
const container = document.querySelector<Div>(".container");
const terminal = document.querySelector<Canvas>(".container > canvas");
const ctx = terminal.getContext("2d");
const title = document.querySelector<Div>(".terminal > .frame > .title");

setTheme("Catppuccin Mocha");

let metrics: TextMetrics;

type RenderStyle = {
    color: string,
    backgroundColor: string,
    bold: boolean,
    dim: boolean,
    italic: boolean,
    underline: boolean,
    blink: boolean,
    rapidBlink: boolean,
    inverse: boolean,
    hidden: boolean,
    strikethrough: boolean,
    cursorVisible: boolean,
    clear?: boolean
};
type RenderPosition = { line: number, column: number };
const defaultStyle: RenderStyle = {
    color: "var(--foreground)", backgroundColor: "var(--background)", bold: false, dim: false, italic: false,
    underline: false, blink: false, rapidBlink: false, inverse: false, hidden: false, strikethrough: false,
    cursorVisible: true
};

const colorMap = {
    30: "black", 31: "red", 32: "green", 33: "yellow",
    34: "blue", 35: "purple", 36: "cyan", 37: "white", 39: "foreground",
    90: "brightBlack", 91: "blackRed", 92: "blackGreen", 93: "blackYellow",
    94: "brightBlue", 95: "brightPurple", 96: "brightCyan", 97: "brightWhite"
} as const;
const bgColorMap = {
    40: "black", 41: "red", 42: "green", 43: "yellow",
    44: "blue", 45: "purple", 46: "cyan", 47: "white", 49: "transparent",
    100: "brightBlack", 101: "blackRed", 102: "blackGreen", 103: "blackYellow",
    104: "brightBlue", 105: "brightPurple", 106: "brightCyan", 107: "brightWhite"
} as const;
const styleAnsi = {
    1: "bold", 2: "dim", 3: "italic", 4: "underline", 5: "blink", 6: "rapidBlink", 7: "inverse", 8: "hidden",
    9: "strikethrough", 21: "-bold", 22: "-bold-dim", 23: "-italic", 24: "-underline", 25: "-blink",
    26: "-rapidBlink", 27: "-inverse", 28: "-hidden", 29: "-strikethrough"
} as const;
export const FG = <Record<typeof colorMap[keyof typeof colorMap], string>>{};
export const BG = <Record<typeof bgColorMap[keyof typeof bgColorMap], string>>{};
export const S = <Record<typeof styleAnsi[keyof typeof styleAnsi] | "clear", string>>{};
for (const key in colorMap) FG[colorMap[key]] = `\x1b[${key}m`;
for (const key in bgColorMap) BG[bgColorMap[key]] = `\x1b[${key}m`;
for (const key in styleAnsi) S[key] = `\x1b[${key}m`;
S.clear = "\x1b[0m";

addEventListener("contextmenu", e => e.preventDefault());
type TerminalNode = {
    apply?: Partial<RenderStyle>,
    processed?: RenderStyle,
    content?: string
};

// todo: scrollbar
// todo: paging optimization
// todo: text selection
// todo: ctrl backspacing & arrowing etc.
// todo: if statements and function definitions for bash

let cursorVisible = true;
const binds: TerminalNode[] = [{}];
const cursor = {bind: 0, index: 0, selectionDirection: 1, selectionTo: null};
let scrollY = 0;
let scrollYRender = 0;
let screenWidth = 0;
let screenHeight = 0;
let renderedHeight = 0;
let cursorPos = {x: 0, y: 0};
let cursorPosRender = {x: 0, y: 0};

export function scrollToBottom() {
    scrollY = Math.max(0, (renderedHeight - screenHeight) * (metrics.fontBoundingBoxAscent + 5));
}

function handleVar(v: string) {
    if (v.startsWith("var(--")) return getTheme().theme[v.slice(6, -1)];
    return v;
}

function appendPart(part: string, apply: Partial<RenderStyle> = {}) {
    const bind = binds[cursor.bind];

    if ("content" in bind) {
        if (Object.keys(apply).length === 0) {
            bind.content = bind.content.slice(0, cursor.index) + part + bind.content.slice(cursor.index);
            cursor.index += part.length;
            return;
        }

        const last = binds[cursor.bind - 1];
        if (!bind.content && last && "content" in last && !last.content) {
            last.apply = {...last.apply, ...apply};
            cursor.index += part.length;
            return;
        }

        if (cursor.index === 0) {
            binds.splice(cursor.bind, 0, {apply, content: part});
            cursor.index = part.length;
        } else if (cursor.index === bind.content.length) {
            binds.splice(cursor.bind + 1, 0, {apply, content: part});
            cursor.bind++;
            cursor.index = 0;
        } else {
            const before = bind.content.slice(0, cursor.index);
            const after = bind.content.slice(cursor.index);
            bind.content = before;
            binds.splice(cursor.bind + 1, 0, {apply: {}, content: after});
            binds.splice(cursor.bind + 1, 0, {apply, content: part});
            cursor.bind++;
            cursor.index = part.length;
            return;
        }
        return;
    }

    binds.splice(cursor.bind + 1, 0, {apply, content: part});
    cursor.bind++;
    cursor.index = part.length;
}

function getBindPoint(line: number, column: number) {
    let l = 0;
    let c = 0;
    let i = 0;
    for (; i < binds.length; i++) {
        const bind = binds[i];
        if (!("content" in bind)) {
            if (line === l) return {bind, bindIndex: i, index: 0};
            l++;
            c = 0;
        } else {
            const cd = c + bind.content.length;
            if (line === l && column >= c && column < cd) return {bind, bindIndex: i, index: column - c};
            c = cd;
        }
    }
    return {bind: binds[i], bindIndex: i, index: column - c};
}

function bindToPoint(i: number) {
    let line = 0;
    let col = 0;
    for (let j = 0; j < i; j++) {
        const bind = binds[j];
        if (!("content" in bind)) {
            line++;
            col = 0;
        } else col += bind.content.length;
    }

    return {col, line};
}

function processPart(part: string, cursorStack: { col: number, line: number }[] = []) {
    if (!part) return;

    if (part === "\n") {
        binds.push({});
        cursor.bind = binds.length - 1;
        cursor.index = 0;
        return;
    }

    if (part === "\t") part = "  ";
    if (part === "\b") {
        if (cursor.index > 0) {
            const bind = binds[cursor.bind];
            if ("content" in bind) {
                bind.content = bind.content.slice(0, cursor.index - 1) + bind.content.slice(cursor.index);
                cursor.index--;
                return;
            }
        }
        const bindInd = cursor.bind;
        let found = false;
        while (cursor.index === 0 && cursor.bind > 0) {
            cursor.bind--;
            const bind = binds[cursor.bind];
            if ("content" in bind) {
                cursor.index = bind.content.length;
                bind.content = bind.content.slice(0, -1);
                found = true;
                break;
            }
        }
        if (!found) cursor.bind = bindInd;
        return;
    }

    let match = part.match(/^\x1b\[(\d+);(\d+)H$/);
    if (match) {
        const row = +match[1];
        const col = +match[2];
        const bind = getBindPoint(row - 1, col - 1);
        cursor.bind = bind.bindIndex;
        cursor.index = bind.index;
        return;
    }

    match = part.match(/^\x1b\[(\d+)([A-G])$/);
    if (match) {
        const count = +match[1];
        const letter = match[2];
        if (letter === "A" || letter === "B") {
            const posBefore = bindToPoint(cursor.bind);
            const pos = getBindPoint(posBefore.col, posBefore.line + (letter === "A" ? 1 : -1) * count);
            cursor.bind = pos.bindIndex;
            cursor.index = pos.index;
            return;
        }
        for (let i = 0; i < count; i++) switch (letter) {
            case "C":
                const bind = binds[cursor.bind];
                if ("content" in bind && cursor.index < bind.content.length) cursor.index++;
                else {
                    const bind = binds[cursor.bind + 1];
                    if (bind && "content" in bind) {
                        cursor.bind++;
                        cursor.index = 0;
                    }
                }
                break;
            case "D":
                if (cursor.index > 0) cursor.index--;
                else {
                    const bind = binds[cursor.bind - 1];
                    if (bind && "content" in bind) {
                        cursor.bind--;
                        cursor.index = bind.content.length;
                    }
                }
                break;
        }
        return;
    }

    match = part.match(/^\x1b\[([0-2][KJ])$/);
    if (match) {
        const code = match[1];
        if (code === "2J") {
            binds.length = 1;
            cursor.bind = 0;
            cursor.index = 0;
            appendPart("", defaultStyle);
        } else if (code === "1J") {
            // todo: clear from cursor to end, not tested
            const bind = binds[cursor.bind];
            if ("content" in bind) bind.content = bind.content.slice(0, cursor.index);
            binds.length = cursor.bind + 1;
        } else if (code === "0J") {
            // todo: clear from cursor to start, not tested
            const bind = binds[cursor.bind];
            if ("content" in bind) bind.content = bind.content.slice(cursor.index);
            for (let i = cursor.bind - 1; i >= 0; i--) {
                const bind = binds[i];
                if ("content" in bind) {
                    bind.content = "";
                    binds.splice(i, 1);
                }
            }
            cursor.bind = 0;
        } else if (code === "2K") {
            // clear line
            const bind = binds[cursor.bind];
            if ("content" in bind) {
                bind.content = "";
                cursor.index = 0;
            }
            while (binds[cursor.bind + 1] && "content" in binds[cursor.bind + 1]) {
                binds.splice(cursor.bind + 1, 1);
            }
            while (binds[cursor.bind - 1] && "content" in binds[cursor.bind - 1]) {
                binds.splice(cursor.bind - 1, 1);
                cursor.bind--;
            }
        } else if (code === "1K") {
            // todo: clear from cursor to end of line, not tested
            let bind: TerminalNode;
            while ((bind = binds[cursor.bind + 1]) && "content" in bind) {
                binds.splice(cursor.bind + 1, 1);
            }
        } else if (code === "0K") {
            // todo: clear from start of line to cursor, not tested
            let bind: TerminalNode;
            while ((bind = binds[cursor.bind - 1]) && "content" in bind) {
                binds.splice(cursor.bind - 1, 1);
                cursor.bind--;
                cursor.index = 0;
            }
        }
        return;
    }

    match = part.match(/^\x1b\[([su])$/);
    if (match) {
        const code = match[1];
        if (code === "s") {
            cursorStack.push(bindToPoint(cursor.bind));
        } else if (code === "u") {
            if (cursorStack.length > 0) {
                const {line, col} = cursorStack.pop()!;
                const {bindIndex, index} = getBindPoint(line, col);
                cursor.bind = bindIndex;
                cursor.index = index;
            }
        }
        return;
    }

    match = part.match(/^\x1b\[\?25([lh])$/);
    if (match) {
        const code = match[1];
        cursorVisible = code === "h";
        return;
    }

    match = part.match(/^\x1b]0;([^\x07]+)\x07$/);
    if (match) {
        title.textContent = match[1];
        return;
    }

    let rgb: number[];
    let rgbType: string;
    match = part.match(/^\x1b\[([34])8;5;(\d{1,3})m$/);
    if (match) {
        rgbType = match[1];
        const colorIndex = +match[2];
        rgb = ansi256ToRgb(colorIndex);
    } else {
        match = part.match(/^\x1b\[([34])8;2;(\d{1,3});(\d{1,3});(\d{1,3})m$/);
        if (match) {
            rgbType = match[1];
            rgb = [+match[2], +match[3], +match[4]];
        }
    }

    if (rgb) {
        appendPart("", {[{3: "color", 4: "backgroundColor"}[rgbType]]: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`});
        return;
    }

    match = part.match(/^\x1b\[(\d{1,2})m$/);
    if (match) {
        const code = +match[1];
        if (code === 0) {
            appendPart("", defaultStyle);
            return;
        }
        const color = colorMap[code];
        if (color) {
            appendPart("", {color: `var(--${color})`});
            return;
        }
        const bgColor = bgColorMap[code];
        if (bgColor) {
            appendPart("", {backgroundColor: `var(--${bgColor})`});
            return;
        }
        const s = styleAnsi[code] || "";
        const style: Partial<RenderStyle> = {};
        if (s.startsWith("-")) s.split("-").slice(1).forEach((i: string) => style[i] = false);
        else s.split("-").forEach((i: string) => style[i] = true);
        appendPart("", style);
        return;
    }

    appendPart(part);
}

/*function applyStyles(span: Span, map: RenderStyle) {
    span.classList.toggle("bold", map.bold);
    span.classList.toggle("italic", map.italic);
    span.classList.toggle("hidden", map.hidden);
    span.classList.toggle("dim", map.dim && !map.hidden);
    span.classList.toggle("underline", map.underline);
    span.classList.toggle("strikethrough", map.strikethrough);
    span.classList.toggle("blink", map.blink);
    span.classList.toggle("rapid-blink", map.rapidBlink);
    span.style.color = map.inverse ? map.backgroundColor : map.color;
    span.style.backgroundColor = map.inverse ? map.color : map.backgroundColor;
}*/

function renderStyledText(text: string, style: RenderStyle, pos: RenderPosition) {
    ctx.fillStyle = handleVar(style.inverse ? style.backgroundColor : style.color);
    const lineMargin = 5;
    ctx.fillText(text,
        10 + Math.round(pos.column * metrics.width),
        10 + (pos.line + 1) * (metrics.fontBoundingBoxAscent + lineMargin) - lineMargin - scrollYRender
    );
}

function render() {
    ctx.clearRect(0, 0, terminal.width, terminal.height);
    scrollYRender += (scrollY - scrollYRender) * 0.1;
    metrics = ctx.measureText("M");
    let pos: RenderPosition = {line: 0, column: 0};
    let curCol = 0;
    let curLine = 0;
    const curBind = binds[cursor.bind];
    for (const part of binds.slice(1)) {
        if (!("content" in part)) {
            pos.line++;
            pos.column = 0;
            if (part === curBind) {
                curCol = 0;
                curLine = pos.line;
            }
            continue;
        }

        if (part === curBind) {
            curCol = pos.column;
            curLine = pos.line;
        }

        let stop = cursor.index;

        for (const char of part.content) {
            if (pos.column >= screenWidth) {
                pos.line++;
                pos.column = 0;
                if (part === curBind && stop > 0) {
                    curCol = 0;
                    curLine++;
                }
            }
            renderStyledText(char, part.processed, pos);
            pos.column++;
            if (part === curBind && stop-- > 0) curCol++;
        }
    }

    renderedHeight = pos.line + 1;

    const lineMargin = 5;
    cursorPos.x = curCol * metrics.width;
    cursorPos.y = (curLine + 0.4) * (metrics.fontBoundingBoxAscent + lineMargin) - lineMargin;

    cursorPosRender.x += (cursorPos.x - cursorPosRender.x) * 0.3;
    cursorPosRender.y += (cursorPos.y - cursorPosRender.y) * 0.3;

    if (cursorVisible) {
        ctx.fillStyle = handleVar("var(--cursor-color)");
        ctx.fillRect(10 + cursorPosRender.x + 1, 10 + cursorPosRender.y - scrollYRender, 1, metrics.fontBoundingBoxAscent);
    }
    scrollY = Math.max(0, Math.min(scrollY, (renderedHeight - 1) * (metrics.fontBoundingBoxAscent + 5)));

    /*ctx.fillStyle = "white";
    const scale = getScale();
    ctx.fillRect(terminal.width / scale, 100 * scale, 100, terminal.height);*/

    requestAnimationFrame(render);
}

function reprocess() {
    let style: RenderStyle = {...defaultStyle};
    for (let i = 1; i < binds.length; i++) {
        const bind = binds[i];
        if (!bind.apply) continue;
        if (bind.apply.clear) style = {...defaultStyle};
        Object.assign(style, bind.apply);
        bind.processed = {...style};
    }
}

export function print(text: string) {
    const parts = text.split(/(\n|\t|\x08|\x1b\[\d+[A-G]|\x1b\[[0-2][KJ]|\x1b\[[su]|\x1b\[\?25[lh]|\x1b]0;[^\x07]*\x07|\x1b\[[34]8;5;\d{1,3}m|\x1b\[[34]8;2;\d{1,3};\d{1,3};\d{1,3}m|\x1b\[\d{1,2}m|\x1b\[\d+;\d+H)/g);
    let cursorStack: { col: number, line: number }[] = [];
    for (let part of parts) processPart(part, cursorStack);
    reprocess();
    if (text.includes("\n")) requestAnimationFrame(scrollToBottom);
}

export function println(text: string) {
    print(text + "\n");
}

function getScale() {
    return (window.devicePixelRatio || 1) * 1.7;
}

function resize() {
    ctx.restore();
    const bound = container.getBoundingClientRect();
    const scale = getScale();
    terminal.width = bound.width * scale;
    terminal.height = bound.height * scale;
    terminal.style.width = bound.width + "px";
    terminal.style.height = bound.height + "px";
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.font = "16px monospace";
    ctx.scale(scale, scale);
    const m = ctx.measureText("M");
    screenWidth = Math.floor((bound.width - 20) / m.width);
    screenHeight = Math.floor((bound.height - 20) / (m.fontBoundingBoxAscent + 5));
}

resize();
render();
addEventListener("resize", () => resize());
terminal.addEventListener("wheel", e => scrollY += e.deltaY * 0.3);
