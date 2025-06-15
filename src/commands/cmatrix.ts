import {CommandDefinition} from "@/commands";
import {canvas, setRenderBlock} from "@/renderer";

export default <CommandDefinition>{
    description: "display a scrolling matrix of characters", async run(args, params, io) {
        if (args.length > 0) {
            io.stderr.write("cmatrix: too many arguments\n");
            return 1;
        }

        setRenderBlock(true);

        const mat: any = await new Promise(r => window["matrix"](canvas, {
            chars: window["matrix"].range(0x30A1, 0x30F6).concat(window["matrix"].range(0x0030, 0x0039)),
            font_size: 16,
            exit: false,
            mount: (matrix: unknown) => r(matrix)
        }));

        await io.term.wait();

        mat.stop();
        setRenderBlock(false);

        return 0;
    }
};