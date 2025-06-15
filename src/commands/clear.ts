import {CommandDefinition} from "@/commands";
import {CTRL} from "@/renderer";

export default <CommandDefinition>{
    description: "clear the terminal screen", async run(_, __, io) {
        io.stdout.write(CTRL.clear);
        return 0;
    }
};