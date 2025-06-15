import {CommandDefinition} from "@/commands";
import {getScreenSize, restoreState, saveState} from "@/renderer";

export default <CommandDefinition>{
    description: "terminal capabilities control",
    async run(args, _, io) {
        if (args.length === 0) {
            io.stderr.write("tput: no argument specified\n");
            return 1;
        }

        switch (args[0]) {
            case "clear":
                io.stdout.write("\x1b[2J");
                break;
            case "lines":
                io.stdout.write(getScreenSize().height + "\n");
                break;
            case "cols":
                io.stdout.write(getScreenSize().width + "\n");
                break;
            case "save":
                saveState();
                break;
            case "restore":
                restoreState();
                break;
            default:
                io.stderr.write(`tput: unknown command '${args[0]}'\n`);
                return 1;
        }
        return 0;
    }
};