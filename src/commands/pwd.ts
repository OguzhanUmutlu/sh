import {CommandDefinition} from "@/commands";
import {cwd, cwdFmt} from "@/command";

export default <CommandDefinition>{
    description: "print the current working directory",
    shortParams: {f: "format"}, namedParams: {format: "prints the current working directory aligning home as ~"},
    async run(args, params, io) {
        io.stdout.write((params.format ? cwdFmt() : cwd()) + "\n");
        return 0;
    }
};