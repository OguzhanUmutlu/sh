import {CommandDefinition} from "@/commands";
import {fs} from "@zenfs/core";
import {P} from "@/command";

export default <CommandDefinition>{
    description: "create directories", async run(args, params, io) {
        if (args.length === 0) {
            io.stderr.write("mkdir: missing operand\n");
            return 1;
        }

        for (const arg of args) {
            try {
                fs.mkdirSync(P(arg), {recursive: true});
            } catch (e) {
                io.stderr.write(`mkdir: cannot create directory '${arg}'\n`);
                return 1;
            }
        }

        return 0;
    }
};