import {CommandDefinition} from "@/commands";

export default <CommandDefinition>{
    description: "exit the shell", async run(_, __, io) {
        io.stdout.write("Exiting...\n");
        await io.stdin.handle(() => close()).wait();
        await new Promise(() => null);
        return 0;
    }
};