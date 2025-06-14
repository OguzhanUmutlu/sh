import {CommandDefinition} from "@/commands";

export default <CommandDefinition>{
    description: "clear the terminal screen", async run(_, __, io) {
        io.stdout.write("\x1b[2J");
        return 0;
    }
};