import {CommandDefinition} from "@/commands";
import {fs} from "@zenfs/core";
import {P} from "@/command";

export default <CommandDefinition>{
    description: "change file timestamps or create empty files", async run(args, params, io) {
        if (args.length === 0) {
            io.stderr.write("touch: missing operand\n");
            return 1;
        }

        for (const arg of args) {
            try {
                fs.writeFileSync(P(arg), "", {flag: "a"});
            } catch (e) {
                io.stderr.write(`touch: cannot touch '${arg}'\n`);
                return 1;
            }
        }

        return 0;
    }
};