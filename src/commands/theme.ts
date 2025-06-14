import {CommandDefinition} from "@/commands";
import {setTheme, Themes} from "@/renderer";

export default <CommandDefinition>{
    description: "change the terminal theme",
    shortParams: {l: "list"}, namedParams: {list: "lists available themes"},
    async run(args, params, io) {
        if (params.list) {
            io.stdout.write("Available themes:\n");
            for (const t of Themes) {
                io.stdout.write(`  theme "${t}"\n`);
            }
            return 0;
        }

        if (args.length === 0) {
            io.stderr.write("theme: missing argument\n");
            return 1;
        }

        const theme = args[0];

        if (!setTheme(theme)) {
            io.stderr.write(`theme: '${theme}' is not a valid theme\n`);
            return 1;
        }

        io.stdout.write(`Theme set to ${theme}\n`);
        return 0;
    }
};