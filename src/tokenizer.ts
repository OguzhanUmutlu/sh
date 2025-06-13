// cmd1; cmd2
// cmd1 | cmd2
// cmd < file.txt
// cmd > file.txt
// cmd >> file.txt
// cmd1 && cmd2
// cmd1 || cmd2
// (cmd1; cmd2)
// var=value
// var=$(ls)
// var='no variable expansion'
// var="variable expansion: $(ls) $var"

export type Token =
    | { type: "word"; value: string }
    | { type: "var"; value: string }
    | { type: "operator"; value: string }
    | { type: "operator_>"; value: { append: boolean, fd: number } }
    | { type: "string"; value: StringTokenValue };

export type StringTokenValue = (string | Substitution | VariableRef)[];
export type Substitution = Token[];
export type VariableRef = { type: "var"; value: string };

function decodeEscape(char: string): string {
    switch (char) {
        case "n":
            return "\n";
        case "t":
            return "\t";
        case "r":
            return "\r";
        case "b":
            return "\b";
        case "f":
            return "\f";
        case "v":
            return "\v";
        default:
            return char;
    }
}

export function tokenize(input: string): Token[] {
    let i = 0;
    const length = input.length;

    function isOperatorChar(c: string) {
        return "|&;<();".includes(c);
    }

    function readWhile(cond: (a: string) => boolean) {
        let str = "";
        while (i < length && cond(input[i])) {
            str += input[i++];
        }
        return str;
    }

    function readVariableName() {
        let name = "";
        if (i < length && /[a-zA-Z_]/.test(input[i])) {
            name += input[i++];
            name += readWhile(ch => /[a-zA-Z0-9_]/.test(ch));
            return name;
        }
        return null;
    }

    function readSubstitution() {
        let depth = 1;
        const tokens = [];
        let currentWord = "";

        while (i < length) {
            const c = input[i];
            if (c === "(") {
                depth++;
                currentWord += c;
                i++;
            } else if (c === ")") {
                depth--;
                if (depth === 0) {
                    i++;
                    break;
                }
                currentWord += c;
                i++;
            } else if (/\s/.test(c)) {
                if (currentWord) {
                    tokens.push({type: "word", value: currentWord});
                    currentWord = "";
                }
                i++;
            } else {
                currentWord += c;
                i++;
            }
        }
        if (currentWord) {
            tokens.push({type: "word", value: currentWord});
        }
        if (depth !== 0) throw new Error("Unclosed substitution");
        return tokens;
    }

    function tokenizeDoubleQuoted() {
        const parts = [];
        let currentStr = "";

        while (i < length) {
            const c = input[i];
            if (c === '"') {
                i++;
                if (currentStr) parts.push(currentStr);
                return parts;
            }
            if (c === "\\") {
                i++;
                if (i < length) {
                    currentStr += input[i++];
                }
            } else if (c === "$") {
                if (currentStr) {
                    parts.push(currentStr);
                    currentStr = "";
                }
                i++;
                if (input[i] === "(") {
                    i++;
                    const subTokens = readSubstitution();
                    parts.push(subTokens);
                } else {
                    const varName = readVariableName();
                    if (varName !== null) {
                        parts.push({type: "var", value: varName});
                    } else {
                        currentStr += "$";
                    }
                }
            } else {
                currentStr += c;
                i++;
            }
        }
        throw new Error("Unclosed double quote");
    }

    const tokens: Token[] = [];

    while (i < length) {
        const c = input[i];

        if (/\s/.test(c)) {
            i++;
            continue;
        }

        if ([">>", "&&", "||"].some(op => input.startsWith(op, i))) {
            tokens.push({type: "operator", value: input.slice(i, i + 2)});
            i += 2;
            continue;
        }

        if (/^\d?>>?/.test(input.slice(i))) {
            tokens.push({
                type: "operator_>", value: {
                    append: input[i + 2] === ">",
                    fd: input[i] === ">" ? 1 : parseInt(input[i])
                }
            });
            i += input[i + 2] === ">" ? 3 : 2;
            continue;
        }

        if (isOperatorChar(c)) {
            tokens.push({type: "operator", value: c});
            i++;
            continue;
        }

        if (c === "'") {
            i++;
            let val = "";
            while (i < length && input[i] !== "'") {
                val += input[i++];
            }
            if (i >= length) throw new Error("Unclosed single quote");
            i++;
            tokens.push({type: "string", value: [val]});
            continue;
        }

        if (c === '"') {
            i++;
            const val = tokenizeDoubleQuoted();
            tokens.push({type: "string", value: val});
            continue;
        }

        if (c === "$" && input[i + 1] === "(") {
            i += 2;
            const subTokens = readSubstitution();
            tokens.push({type: "string", value: [subTokens]});
            continue;
        }

        if (c === "$") {
            i++;
            const varName = readVariableName();
            if (varName !== null) {
                tokens.push({type: "var", value: varName});
            } else {
                tokens.push({type: "word", value: "$"});
            }
            continue;
        }

        const word = readWhile(ch => !/\s/.test(ch) && !isOperatorChar(ch) && ch !== "'" && ch !== '"' && ch !== "$");
        tokens.push({type: "word", value: word});
    }

    return tokens;
}
