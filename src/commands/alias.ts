import {CommandDefinition} from "@/commands";
import {Aliases} from "@/command";

export default <CommandDefinition>{
    description: "create an alias for a command",
    shortParams: {d: "delete"},
    namedParams: {delete: "deletes an existing alias"},
    async run(args, params, io) {
        for (const arg of args) {
            const [name, ...valueParts] = arg.split("=");
            const value = valueParts.join("=");
            if (params.delete) {
                if (Aliases[name]) {
                    delete Aliases[name];
                    io.stdout.write(`Alias '${name}' deleted.\n`);
                } else {
                    io.stderr.write(`alias: '${name}' not found.\n`);
                    return 1;
                }
            } else {
                if (!value) {
                    io.stderr.write(`alias: missing value for alias '${name}'\n`);
                    return 1;
                }
                Aliases[name] = value;
                io.stdout.write(`Alias '${name}' set to '${value}'.\n`);
            }
        }
        return 0;
    }
};