// @ts-ignore
import {schemes, themes} from "./theme.json";

export const Themes = themes.map((i: { name: string }) => i.name);

let curTheme: any;

export function setTheme(name: string) {
    const theme = themes.find(i => i.name === name);
    const scheme = schemes.find(i => i.name === name);
    if (!theme || !scheme) return false;
    curTheme = {theme, scheme};
    const root = document.documentElement.style;
    for (const key in theme) root.setProperty(`--${key}`, theme[key]);
    //root.setProperty("--tab-background", scheme?.tab?.background)
    return true;
}

export function getTheme() {
    return curTheme;
}