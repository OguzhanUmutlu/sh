import {CommandDefinition} from "@/commands";

export default <CommandDefinition>{
    description: "opens the source code repository on GitHub", async run() {
        open("https://github.com/OguzhanUmutlu/sh");
        return 0;
    }
};