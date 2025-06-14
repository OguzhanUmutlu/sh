import {CommandDefinition} from "@/commands";

export default <CommandDefinition>{
    description: "colorize output text in rainbow colors",
    async run(args, _, io) {
        const text = args.join(" ");
        if (!text) return 0;
        const colors = [31, 33, 32, 36, 34, 35];
        let colored = "";
        for (let i = 0; i < text.length; i++) {
            const c = colors[i % colors.length];
            colored += `\x1b[${c}m${text[i]}`;
        }
        colored += "\x1b[0m\n";
        io.stdout.write(colored);
        return 0;
    }
};