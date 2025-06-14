import {CommandDefinition} from "@/commands";
import {fs} from "@zenfs/core";
import {P} from "@/command";

export default <CommandDefinition>{
    description: "list directory contents", shortParams: {"a": "all"},
    namedParams: {"all": "shows hidden files"},
    async run(args, params, io) {
        const path = args[0] || ".";
        try {
            let files = fs.readdirSync(P(path));
            if (!params.all) {
                files = files.filter(file => !file.startsWith("."));
            }

            if (files.length === 0) return 0;
            else io.stdout.write(files.join("\n") + "\n");
        } catch (e) {
            io.stderr.write(`ls: cannot access '${path}': No such file or directory\n`);
            return 1;
        }
        return 0;
    }
};