import {CommandDefinition} from "@/commands";
import figlet from "figlet";
import Standard from "figlet/importable-fonts/Standard.js";

console.time("figlet:parseFont");
figlet.parseFont("Standard", Standard);
console.timeEnd("figlet:parseFont");

export default <CommandDefinition>{
    description: "display text in large ASCII art format",
    async run(args, _, io) {
        const text = args.join(" ");
        if (!text) return 0;

        try {
            const result = figlet.textSync(text, {font: "Standard"});
            io.stdout.write(result + "\n");
            return 0;
        } catch (error) {
            io.stderr.write(`Error generating ASCII art: ${error.message}\n`);
            return 1;
        }
    }
};