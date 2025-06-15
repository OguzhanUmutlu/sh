import {CommandDefinition} from "@/commands";
import {FG, S} from "@/renderer";

export default <CommandDefinition>{
    description: "colorize output text in rainbow colors",
    async run(args, _, io) {
        const text = args.join(" ");
        if (!text) return 0;
        const colors: (keyof typeof FG)[] = ["red", "yellow", "green", "cyan", "blue", "purple"];
        let colored = "";
        for (let i = 0; i < text.length; i++) {
            const c = colors[i % colors.length];
            colored += `${FG[c]}${text[i]}`;
        }
        colored += `${S.reset}\n`;
        io.stdout.write(colored);
        return 0;
    }
};