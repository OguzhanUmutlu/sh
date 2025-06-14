import {CommandDefinition} from "@/commands";
import {P} from "@/command";
import {fs} from "@zenfs/core";
import {print} from "@/renderer";

export default <CommandDefinition>{
    description: "text editor", async run(args, params, io) {
        io.stdout.write("We're no strangers to love\n" +
            "You know the rules and so do I\n" +
            "A full commitment's what I'm thinkin' of\n" +
            "You wouldn't get this from any other guy\n" +
            "I just wanna tell you how I'm feeling\n" +
            "Gotta make you understand\n" +
            "Never gonna give you up, never gonna let you down\n" +
            "Never gonna run around and desert you\n" +
            "Never gonna make you cry, never gonna say goodbye\n" +
            "Never gonna tell a lie and hurt you\n" +
            "We've known each other for so long\n" +
            "Your heart's been aching, but you're too shy to say it\n" +
            "Inside, we both know what's been going on\n" +
            "We know the game and we're gonna play it\n" +
            "And if you ask me how I'm feeling\n" +
            "Don't tell me you're too blind to see\n" +
            "Never gonna give you up, never gonna let you down\n" +
            "Never gonna run around and desert you\n" +
            "Never gonna make you cry, never gonna say goodbye\n" +
            "Never gonna tell a lie and hurt you\n" +
            "Never gonna give you up, never gonna let you down\n" +
            "Never gonna run around and desert you\n" +
            "Never gonna make you cry, never gonna say goodbye\n" +
            "Never gonna tell a lie and hurt you\n" +
            "We've known each other for so long\n" +
            "Your heart's been aching, but you're too shy to say it\n" +
            "Inside, we both know what's been going on\n" +
            "We know the game and we're gonna play it\n" +
            "I just wanna tell you how I'm feeling\n" +
            "Gotta make you understand\n" +
            "Never gonna give you up, never gonna let you down\n" +
            "Never gonna run around and desert you\n" +
            "Never gonna make you cry, never gonna say goodbye\n" +
            "Never gonna tell a lie and hurt you\n" +
            "Never gonna give you up, never gonna let you down\n" +
            "Never gonna run around and desert you\n" +
            "Never gonna make you cry, never gonna say goodbye\n" +
            "Never gonna tell a lie and hurt you\n" +
            "Never gonna give you up, never gonna let you down\n" +
            "Never gonna run around and desert you\n" +
            "Never gonna make you cry, never gonna say goodbye\n" +
            "Never gonna tell a lie and hurt you\n");
        return;
        if (args.length === 0) {
            io.stderr.write("vim: missing file argument\n");
            return 1;
        }

        const file = P(args[0]);
        let content = "";
        if (fs.existsSync(file)) {
            content = fs.readFileSync(file, "utf8");
        }

        io.stdout.write(`Editing ${file}...\n`);
        io.stdout.write(content + "\n");

        io.stdin.open();

        let cmd = null;

        io.stdin.open();

        let res: (v?: unknown) => void;
        const p = new Promise(r => res = r);
        io.stdin.cb = function (input: string) {
            if (!input) return;

            if (input === ":") {
                cmd = "";
                return;
            }

            if (cmd !== null) {
                if (input === "\n") {
                    for (const c of cmd) {
                        if (c === "w") {
                            fs.writeFileSync(file, content, "utf8");
                            io.stdout.write(`Saved ${file}\n`);
                        } else if (c === "q") {
                            io.stdin.end();
                            io.stdout.write(`Exiting vim...\n`);
                            res();
                            return;
                        }
                    }
                    cmd = null;
                } else cmd += input;
                return;
            }

            print(input);
        }
        await p;

        return 0;
    }
};