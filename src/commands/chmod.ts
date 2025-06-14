import {CommandDefinition} from "@/commands";
import {P} from "@/command";
import {fs} from "@zenfs/core";

export default <CommandDefinition>{
    description: "change file mode bits", async run(args, params, io) {
        if (args.length < 2) {
            io.stderr.write("chmod: missing operand\n");
            return 1;
        }

        let mode = args[0];
        const files = args.slice(1);
        let plus = mode[0] !== "-";
        if (mode[0] === "-" || mode[0] === "+") mode = mode.slice(1);
        const s = {r: 0o400, w: 0o222, x: 0o111, a: 0o777, u: 0o700, g: 0o070, o: 0o007};

        for (let fileO of files) {
            const file = P(fileO);
            let stat: fs.Stats;
            if (!fs.existsSync(file) || !(stat = fs.statSync(file)).isFile()) {
                io.stderr.write(`chmod: cannot access '${fileO}': No such file or directory\n`);
                return 1;
            }
            for (const char of mode) {
                if (s[char]) fs.chmodSync(file, plus ? stat.mode | s[char] : stat.mode & ~s[char]);
                else {
                    io.stderr.write(`chmod: invalid mode '${mode}'\n`);
                    return 1;
                }
            }
        }

        return 0;
    }
};