import {CommandDefinition} from "@/commands";
import {pickPromise, wait} from "@/utils";

export default <CommandDefinition>{
    description: "", async run(args, _, io) {
        if (args.length === 0) {
            io.stderr.write("sleep: missing operand\n");
            return 1;
        }

        if (args.length > 1) {
            io.stderr.write("sleep: too many operands\n");
            return 1;
        }

        const time = parseFloat(args[0]) * 1000;

        if (isNaN(time) || time < 0) {
            io.stderr.write("sleep: invalid time argument\n");
            return 1;
        }

        await pickPromise([io.term.wait(), wait(time)]);

        return 0;
    }
};