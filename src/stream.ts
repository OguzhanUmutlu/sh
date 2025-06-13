import {fs} from "@zenfs/core";
import {FG, print} from "./renderer";
import {P} from "./command";

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
    read(): string;
    readLine(): string;
    readChar(): string;
    end(): void;
}

export class NullReader implements Reader {
    readChar() {
        return "";
    };

    readLine(): string {
        return "";
    };

    read(): string {
        return "";
    };

    end() {
    };
}

export class FileReader implements Reader {
    private readonly content: string;
    private index = 0;

    constructor(private path: string) {
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

    end() {
    };
}

export const defaultStdout: Writer = new Writer((data: string) => print(data), () => void 0);
export const defaultStderr: Writer = new Writer((data: string) => print(FG.red + data + "\x1b[0m"), () => void 0);
export const nullReader: Reader = new NullReader();

export class IO {
    constructor(public stdin = nullReader, public stdout = defaultStdout, public stderr = defaultStderr) {
    };
}