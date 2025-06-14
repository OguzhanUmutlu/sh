import {CommandDefinition} from "@/commands";
import {variables} from "@/command";

export default <CommandDefinition>{
    description: "sets a variable", async run(args, params, io) {
        for (const assignment of args) {
            const eq = assignment.indexOf("=");
            if (eq === -1) {
                io.stderr.write(`set: invalid assignment '${assignment}'\n`);
                return 1;
            }

            const name = assignment.slice(0, eq);
            variables[name] = assignment.slice(eq + 1);
        }
        return 0;
    }
};