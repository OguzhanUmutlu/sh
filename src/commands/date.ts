import {CommandDefinition} from "@/commands";

export default <CommandDefinition>{
    description: "display or set the system date and time",
    shortParams: {u: "utc"},
    namedParams: {utc: "display the date in UTC"},
    async run(args, params, io) {
        const date = new Date();
        const formatted = date.toLocaleString("en-US", {
            timeZone: params.utc ? "UTC" : undefined,
            weekday: "short",
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            timeZoneName: "shortOffset",
        });

        console.log(formatted)

        const spl = formatted.split(", ");

        const result = spl[0] + " " + spl[1] + " " + spl[3].replace(/GMT\+\d+/, r => "+" + r.slice(4).padStart(2, "0")) + " " + date.getFullYear();

        if (args.length > 0) {
            io.stderr.write("date: too many arguments\n");
            return 1;
        }
        io.stdout.write(result + "\n");
        return 0;
    }
};