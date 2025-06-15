import {CommandDefinition} from "@/commands";
import {fs} from "@zenfs/core";
import {P} from "@/command";
import {pickPromise} from "@/utils";

export default <CommandDefinition>{
    description: "transfer data from or to a server using URL syntax",
    shortParams: {o: "output"},
    namedParams: {
        output: "write output to <file> instead of stdout"
    },
    async run(args, params, io) {
        if (args.length === 0) {
            io.stderr.write("curl: no URL specified\n");
            return 1;
        }

        const url = args[0];
        let outputFile = params.output;

        try {
            const [response, i] = await pickPromise([fetch(url), io.term.wait()]);
            if (i === 1) return 0;
            if (!response.ok) {
                io.stderr.write(`curl: failed to fetch '${url}': ${response.status} ${response.statusText}\n`);
                return 1;
            }

            const data = await response.arrayBuffer();
            if (outputFile) fs.writeFileSync(P(<string>outputFile), Buffer.from(data));
            else io.stdout.write(Buffer.from(data).toString());
        } catch (e) {
            io.stderr.write(`curl: error fetching '${url}': ${e.message}\n`);
            return 1;
        }

        return 0;
    }
};
