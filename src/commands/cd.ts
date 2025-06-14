import {CommandDefinition} from "@/commands";
import {chdir} from "@/command";

export default <CommandDefinition>{
    description: "change the current directory", async run(args, params, io) {
        if (args.length === 0) args.push("~");
        let path = args[0];
        if (path.startsWith("~")) path = path.replace("~", "/home");
        try {
            chdir(path);
        } catch (e) {
            io.stderr.write(`cd: ${path}: No such file or directory\n`);
            return 1;
        }
        return 0;
    }
};