import {CommandDefinition, Commands} from "@/commands";

export default <CommandDefinition>{
    description: "help menu", async run(_, __, io) {
        io.stdout.write("Available commands:\n");
        const names = Object.keys(Commands).sort();
        const maxLength = Math.max(...names.map(name => name.length));
        for (const name of names) {
            io.stdout.write(`  ${name.padEnd(maxLength)} - ${Commands[name].description}\n`);
        }
        return 0;
    }
};