import {fs} from "@zenfs/core";
import {P} from "@/command";
import {CommandDefinition} from "@/commands";

export default <CommandDefinition>{
    description: "concatenate files and print on the standard output", async run(args, params, io) {
        if (args.length === 0) {
            io.stderr.write("cat: missing operand\n");
            return 1;
        }

        for (const arg of args) {
            try {
                const content = fs.readFileSync(P(arg), "utf8");
                io.stdout.write(content);
            } catch (e) {
                io.stderr.write(`cat: ${arg}: No such file or directory\n`);
                return 1;
            }
        }

        return 0;
    }
};