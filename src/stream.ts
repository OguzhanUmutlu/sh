import {fs} from "@zenfs/core";
import {FG, print} from "./renderer";
import {P} from "./command";
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

export function handleStdin(stdin: Reader, cb: (input: string, close: () => void) => void) {
    let res: (v: unknown) => void;
    const promise = new Promise(r => res = r);

    function close() {
        clearInterval(int);
        stdin.end();
        res(0);
    }

    const int = setInterval(() => {
        const read = stdin.read();
        cb(read, close);
    });

    return promise;
}

export class BaseReader implements Reader {
    buffer = "";
    private closer: (() => void) | null = null;
    cb: ((input: string) => void) | null = null;

    open() {
        if (this.closer) return;
        this.closer = openStdin(i => {
            this.buffer += i;
            if (this.cb) this.cb(i);
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

    end() {
        if (this.closer) {
            this.closer();
            this.closer = null;
        }
    };
}

export class FileReader implements Reader {
    private readonly content: string;
    private index = 0;

    constructor(private path: string) {
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
export const baseStdin: Reader = new BaseReader();

export class IO {
    constructor(public stdin = baseStdin, public stdout = defaultStdout, public stderr = defaultStderr) {
    };
}