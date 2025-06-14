import {fs} from "@zenfs/core";
import {FG, print} from "@/renderer";
import {P} from "@/command";
import {openStdin} from "@/main";

export class Writer {
    constructor(private writeFn: (data: string) => void, private end: () => void) {
    };

    write(data: string): void {
        this.writeFn(data);
    };
}

export class FileWriter extends Writer {
    constructor(private path: string, private append: boolean) {
        const stream = fs.createWriteStream(P(path), {flags: append ? "a" : "w"});
        super(data => stream.write(data), () => stream.end());
    };
}

export interface Reader {
    open(): void;
    read(): string;
    readLine(): string;
    readChar(): string;
    end(): void;
}

export class Reader {
    buffer = "";
    private closer: (() => void) | null = null;
    cb: ((input: string) => void)[] = [];

    open() {
        if (this.closer) return;
        this.closer = openStdin(i => {
            this.buffer += i;
            for (const cb of this.cb) if (this.closer) cb(i);
        });
    };

    readChar() {
        if (this.buffer.length === 0) return "";
        const pop = this.buffer[0];
        this.buffer = this.buffer.slice(1);
        return pop;
    };

    readLine(): string {
        const endIndex = this.buffer.indexOf("\n");
        if (endIndex === -1) {
            const line = this.buffer;
            this.buffer = "";
            return line;
        }
        const line = this.buffer.slice(0, endIndex);
        this.buffer = this.buffer.slice(endIndex + 1);
        return line;
    };

    read(): string {
        const allContent = this.buffer;
        this.buffer = "";
        return allContent;
    };

    async handle(cb: (input: string, close: () => void) => void) {
        this.open();

        let res: (v: unknown) => void;
        const promise = new Promise(r => res = r);
        this.cb.push(input => cb(input, () => {
            this.end();
            res(null);
        }));
        await promise;
    };

    async term() {
        await this.handle((input, close) => {
            if (input === "\x1b{c}c") close();
        });
    };

    end() {
        if (this.closer) {
            this.closer();
            this.closer = null;
        }
    };
}

export class FileReader extends Reader {
    private readonly content: string;
    private index = 0;

    constructor(private path: string) {
        super();
        this.content = fs.readFileSync(P(path), "utf8");
    };

    open() {
    };

    readChar() {
        if (this.index >= this.content.length) return null;
        return this.content[this.index++];
    };

    read(): string {
        const allContent = this.content.slice(this.index);
        this.index = this.content.length;
        return allContent;
    };

    readLine(): string {
        const endIndex = this.content.indexOf("\n", this.index);
        if (endIndex === -1) {
            const line = this.content.slice(this.index);
            this.index = this.content.length;
            return line;
        }
        const line = this.content.slice(this.index, endIndex);
        this.index = endIndex + 1;
        return line;
    };

    end() {
    };
}

export const defaultStdout: Writer = new Writer((data: string) => print(data), () => void 0);
export const defaultStderr: Writer = new Writer((data: string) => print(FG.red + data + "\x1b[0m"), () => void 0);
export const baseStdin = new Reader();

export class IO {
    constructor(public stdin = baseStdin, public stdout = defaultStdout, public stderr = defaultStderr) {
    };
}