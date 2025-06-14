import {CommandDefinition} from "@/commands";

export default <CommandDefinition>{
    description: "display a message as if spoken by a cow",
    async run(args, params, io) {
        const message = args.join(" ") || "Moo";
        const border = "_".repeat(message.length + 2);
        const cow = `
 ${border}
< ${message} >
 ${"-".repeat(message.length + 2)}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||
`;
        io.stdout.write(cow);
        return 0;
    }
};