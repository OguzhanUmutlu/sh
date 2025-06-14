import {IO} from "@/stream";
import help from "@/commands/help";
import clear from "@/commands/clear";
import echo from "@/commands/echo";
import cat from "@/commands/cat";
import grep from "@/commands/grep";
import set from "@/commands/set";
import ls from "@/commands/ls";
import rm from "@/commands/rm";
import lolcat from "@/commands/lolcat";
import cowsay from "@/commands/cowsay";
import figlet from "@/commands/figlet";
import alias from "@/commands/alias";
import git from "@/commands/git";
import github from "@/commands/github";
import chmod from "@/commands/chmod";
import theme from "@/commands/theme";
import touch from "@/commands/touch";
import pwd from "@/commands/pwd";
import cd from "@/commands/cd";
import mkdir from "@/commands/mkdir";
import date from "@/commands/date";
import vim from "@/commands/vim";
import exit from "@/commands/exit";
import cmatrix from "@/commands/cmatrix";
import sleep from "@/commands/sleep";
import timeout from "@/commands/timeout";
import yes from "@/commands/yes";
import curl from "@/commands/curl";

export type CommandDefinition<T extends string = string> = {
    description: string,
    namedParams?: Record<T, string>,
    shortParams?: Record<string, string>,
    run: (args: string[], params: Record<T, boolean>, io: IO) => Promise<number>
};

export const Commands: Record<string, CommandDefinition> = {
    help, clear, echo, cat, grep, set, ls, rm, cowsay, lolcat, figlet, alias, date, cd, mkdir, pwd, touch, theme,
    chmod, github, git, vim, exit, cmatrix, sleep, timeout, yes, curl
};