import {CommandDefinition} from "@/commands";
import RandExp from "randexp";

export default <CommandDefinition>{
    description: "generate a random number or string",
    shortParams: {p: "pattern", c: "crypto"},
    namedParams: {
        pattern: "the pattern of characters, default=[1-9]\\d{0,9}",
        crypto: "use cryptographically secure numbers",
    },
    async run(args, params, io) {
        let {min = 1, max = 10, pattern = true, crypto} = params;
        min = +min;
        max = +max;
        if (isNaN(min) || isNaN(max)) {
            io.stderr.write("Invalid parameters: min and max must be numbers.\n");
            return 1;
        }
        const rexp = new RandExp(typeof pattern === "string" ? <string>pattern : String.raw`[1-9]\d{0,9}`);
        if (crypto) rexp.randInt = function (min, max) {
            const crypto = globalThis.crypto || globalThis.msCrypto;
            if (!crypto || !crypto.getRandomValues) {
                io.stderr.write("Crypto API not available\n");
                return 1;
            }
            const range = max - min + 1;
            const buffer = new Uint32Array(1);
            do {
                crypto.getRandomValues(buffer);
            } while (buffer[0] >= Math.floor(4294967296 / range) * range);
            return min + (buffer[0] % range);
        };
        io.stdout.write(rexp.gen() + "\n");
        return 0;
    }
};