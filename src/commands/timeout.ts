import {CommandDefinition} from "@/commands";
import {pickPromise, wait} from "@/utils";
import {runCommand} from "@/command";

export default <CommandDefinition>{
    description: "", async run(args, _, io) {
        if (args.length < 2) {
            io.stderr.write("timeout: missing operand\n");
            return 1;
        }

        const time = parseFloat(args[0]) * 1000;
        const command = args.slice(1).join(" ");

        if (isNaN(time) || time < 0) {
            io.stderr.write("timeout: invalid time argument\n");
            return 1;
        }

        const cmd = runCommand(command, io);

        await pickPromise([io.term.wait(), wait(time), cmd.wait()]);

        if (cmd.exitCode === -1) cmd.abort();

        return 0;
    }
};