import {CommandDefinition} from "@/commands";
import {P} from "@/command";
import {fs} from "@zenfs/core";
import {CTRL, CTRL_f, FG, getScreenSize, restoreState, S, saveState} from "@/renderer";
import path from "path";

export default <CommandDefinition>{
    description: "text editor", async run(args, _, io) {
        if (args.length === 0) {
            io.stderr.write("vim: no file specified\n");
            return 1;
        }

        const filePath = P(args[0]);

        if (!fs.existsSync(filePath)) {
            if (!fs.existsSync(path.dirname(filePath))) {
                io.stderr.write(`vim: cannot access '${filePath}': no such file or directory\n`);
                return 1;
            }
            fs.writeFileSync(filePath, "");
        } else if (!fs.statSync(filePath).isFile()) {
            io.stderr.write(`vim: cannot access '${filePath}': is directory\n`);
            return 1;
        }

        let savedCode = fs.readFileSync(filePath, "utf8");
        let code = savedCode;

        let cursorIndex = 0;
        let cursorColumn = 0;
        let cursorLine = 0;
        let scrollOffset = 0;

        saveState();

        function updateCursor() {
            io.stdout.write(CTRL.cursorTo(cursorLine + scrollOffset, cursorColumn));
        }

        function onResize() {
            const {width, height} = getScreenSize();
            io.stdout.write(CTRL.clear);
            const lines = code.split("\n");
            for (let i = 0; i < height - 1; i++) {
                const li = scrollOffset + i;
                const line = li < lines.length ? lines[li] : `${FG.blue}~${S.reset}`;
                io.stdout.write(line + "\n");
            }
            if (cmd) return io.stdout.write(cmd);
            switch (mode) {
                case "n":
                    io.stdout.write(" ");
                    break;
                case "i":
                    io.stdout.write(`${FG.green}-- INSERT --${S.reset}`);
                    break;
            }
            updateCursor();
        }

        let mode = "n";
        let cmd = "";

        addEventListener("resize", onResize);
        onResize();

        await io.stdin.handle((input, close) => {
            if (cmd) {
                if (input === "\n") {
                    if (cmd === ":w") {
                        fs.writeFileSync(filePath, code);
                        io.stdout.write(`${CTRL.clearLine}${FG.green}Saved to ${filePath}${S.reset}`);
                        updateCursor();
                        savedCode = code;
                    } else if (cmd === ":q") {
                        if (savedCode !== code) {
                            io.stdout.write(`${CTRL.clearLine}${FG.red}File has unsaved changes. Use ':w' to save or ':q!' to quit without saving.${S.reset}`);
                            cmd = "";
                            updateCursor();
                            return;
                        }
                        close();
                        return;
                    } else if (cmd === ":q!") {
                        close();
                        return;
                    } else if (cmd === ":wq") {
                        fs.writeFileSync(filePath, code);
                        close();
                        return;
                    } else {
                        io.stdout.write(`${CTRL.clearLine}${FG.red}unknown command: ${cmd}${S.reset}`);
                        updateCursor();
                    }
                    cmd = "";
                } else if (input === CTRL.escape) {
                    mode = "n";
                    cmd = "";
                    io.stdout.write(`${CTRL.clearLine}`);
                    updateCursor();
                } else if (input === CTRL.backspace) {
                    if (cmd.length > 0) cmd = cmd.slice(0, -1);
                    io.stdout.write(input);
                    if (cmd.length === 0) {
                        io.stdout.write(`${CTRL.clearLine}`);
                        updateCursor();
                    }
                } else if (input.length === 1) {
                    cmd += input;
                    io.stdout.write(input);
                }

                return;
            }
            switch (mode) {
                case "n":
                    if (input === "i") {
                        mode = "i";
                        io.stdout.write(`${CTRL.cursorTo(getScreenSize().height, 0)}${CTRL.clearLine}${FG.green}-- INSERT --${S.reset}`);
                        updateCursor();
                    } else if (input === ":") {
                        cmd += input;
                        io.stdout.write(`${CTRL.cursorTo(getScreenSize().height, 0)}${CTRL.clearLine}${S.reset}:`);
                    }
                    break;
                case "i":
                    if (input === CTRL.escape) {
                        mode = "n";
                        onResize();
                    } else if (input === CTRL.backspace) {
                        if (cursorIndex > 0) {
                            code = code.slice(0, cursorIndex - 1) + code.slice(cursorIndex);
                            cursorIndex--;
                            cursorColumn--;
                            if (cursorColumn < 0) {
                                cursorLine--;
                                const lines = code.split("\n");
                                cursorColumn = lines[cursorLine].length;
                                onResize();
                            } else io.stdout.write("\b");
                        }
                    } else if (input === CTRL.delete) {
                        if (cursorIndex < code.length) {
                            code = code.slice(0, cursorIndex) + code.slice(cursorIndex + 1);
                        }
                    } else if (CTRL_f.cursorLeft(input)) {
                        const amount = CTRL_f.cursorLeft(input);
                        if (cursorIndex > 0) {
                            cursorIndex -= amount;
                            if (cursorIndex < 0) cursorIndex = 0;
                            const lines = code.slice(0, cursorIndex).split("\n");
                            cursorLine = lines.length - 1;
                            cursorColumn = lines[cursorLine].length;
                            updateCursor();
                        }
                    } else if (CTRL_f.cursorRight(input)) {
                        const amount = CTRL_f.cursorRight(input);
                        if (cursorIndex < code.length) {
                            cursorIndex += amount;
                            if (cursorIndex > code.length) cursorIndex = code.length;
                            const lines = code.slice(0, cursorIndex).split("\n");
                            cursorLine = lines.length - 1;
                            cursorColumn = lines[cursorLine].length;
                            updateCursor();
                        }
                    } else if (input.length === 1) {
                        code = code.slice(0, cursorIndex) + input + code.slice(cursorIndex);
                        cursorIndex++;
                        cursorColumn++;
                        if (input === "\n") {
                            cursorLine++;
                            cursorColumn = 0;
                            onResize();
                        } else io.stdout.write(input);
                    }
                    break;
            }
        }).wait();

        restoreState();

        return 0;
    }
};