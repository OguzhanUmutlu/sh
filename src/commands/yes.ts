import {CommandDefinition} from "@/commands";

export default <CommandDefinition>{
    description: "output a string repeatedly", async run(args, params, io) {
        const message = args.join(" ") || "y";
        const int = setInterval(() => io.stdout.write(message + "\n"));
        await io.stdin.term();
        clearInterval(int);
        return 0;
    }
};