import {baseStdin} from "@/stream";
import {CommandDefinition} from "@/commands";

export default <CommandDefinition>{
    description: "display a line of text",
    shortParams: {n: "no-newline", r: "reverse"},
    namedParams: {"no-newline": "do not output the trailing newline", reverse: "reverse the output"},
    async run(args, params, io) {
        let message = args.join(" ");
        if (io.stdin !== baseStdin) message = io.stdin.read().trim() + " " + message;
        message = message.replace("\n", " ") + (params["no-newline"] ? "" : "\n");
        if (params.reverse) message = message.split("").reverse().join("");
        io.stdout.write(message);
        return 0;
    }
};