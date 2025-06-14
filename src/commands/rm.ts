import {CommandDefinition} from "@/commands";
import {fs} from "@zenfs/core";
import {P} from "@/command";

export default <CommandDefinition>{
    description: "remove files or directories",
    shortParams: {r: "recursive", f: "force"},
    namedParams: {
        recursive: "remove directories and their contents recursively",
        force: "ignore nonexistent files and arguments, never prompt"
    }, async run(args, params, io) {
        if (args.length === 0) {
            io.stderr.write("rm: missing operand\n");
            return 1;
        }

        for (const arg of args) {
            try {
                const stat = fs.statSync(P(arg));
                if (stat.isDirectory() && !params.recursive) {
                    io.stderr.write(`rm: cannot remove '${arg}': Is a directory\n`);
                    return 1;
                }
                fs.rmSync(P(arg), {recursive: params.recursive, force: params.force});
            } catch (e) {
                if (P(arg) === "/") return 0;
                io.stderr.write(`rm: ${arg}: No such file or directory\n`);
                return 1;
            }
        }

        return 0;
    }
};