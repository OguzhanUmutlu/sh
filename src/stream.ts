import {fs} from "@zenfs/core";
import {CTRL, FG, print, S} from "@/renderer";
import {P} from "@/command";

export class Writer {
    constructor(private writeFn: (data: string) => void) {
    };

    write(data: string): void {
        this.writeFn(data);
    };
}

export class FileWriter extends Writer {
    constructor(path: string, append: boolean) {
        path = P(path);
        super(data => {
            if (append) fs.appendFileSync(path, data);
            else fs.writeFileSync(path, data);
        });
    };
}

export class Reader {
    buffer = "";
    callbacks: ((input: string) => void)[] = [];

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

    handle(cb: (input: string, close: () => void) => void) {
        let res: (v: unknown) => void;
        const promise = new Promise(r => res = r);
        const handler = (input: string) => cb(input, () => {
            res(null);
            const index = this.callbacks.indexOf(handler);
            if (index !== -1) this.callbacks.splice(index, 1);
        });
        this.callbacks.push(handler);
        return {
            wait: () => promise, handler, remove: () => {
                const index = this.callbacks.indexOf(handler);
                if (index !== -1) this.callbacks.splice(index, 1);
            }
        };
    };

    term() {
        return this.handle((input, close) => {
            if (input === `${CTRL.spec("ctrl")}c`) close();
        });
    };
}

export class FileReader extends Reader {
    private readonly content: string;
    private index = 0;

    constructor(path: string) {
        super();
        this.content = fs.readFileSync(P(path), "utf8");
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
}

export const defaultStdout: Writer = new Writer((data: string) => print(data));
export const defaultStderr: Writer = new Writer((data: string) => print(FG.red + data + S.reset));
export const baseStdin = new Reader();

export class IO {
    constructor(
        public stdin = baseStdin,
        public stdout = defaultStdout,
        public stderr = defaultStderr,
        public term = stdin.term()
    ) {
    };
}