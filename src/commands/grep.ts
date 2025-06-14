import {CommandDefinition} from "@/commands";
import {fs} from "@zenfs/core";
import {P} from "@/command";
import {baseStdin} from "@/stream";

export default <CommandDefinition>{
    description: "print lines that match patterns", async run(args, params, io) {
        if (args.length < 1) {
            io.stderr.write("grep: usage: grep PATTERN [FILE...]\n");
            return 1;
        }

        const pattern = args[0];
        const files = args.slice(1);
        const regex = new RegExp(pattern);

        if (files.length > 0) {
            for (const file of files) {
                try {
                    const content = fs.readFileSync(P(file), "utf8");
                    const lines = content.split("\n");
                    for (const line of lines) if (regex.test(line)) io.stdout.write(line + "\n");
                } catch (e) {
                    io.stderr.write(`grep: ${file}: No such file or directory\n`);
                    return 1;
                }
            }
        } else if (io.stdin !== baseStdin) {
            const input = io.stdin.read();
            const lines = input.split("\n");
            for (const line of lines) if (regex.test(line)) io.stdout.write(line + "\n");
        } else {
            io.stderr.write("grep: no input provided\n");
            return 1;
        }

        return 0;
    }
};