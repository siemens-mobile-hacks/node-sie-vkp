export interface VkpLocation {
	line: number;
	column: number;
}

export class VkpParseError extends Error {
	loc: VkpLocation;
	hint?: string;
	constructor(message: string, loc: VkpLocation, hint?: string) {
		super(`${message} at line ${loc.line} col ${loc.column}${hint ? "\n" + hint : ""}`);
		this.name = "VkpParseError";
		this.loc = loc;
		this.hint = hint;
	}

	codeFrame(text: string): string {
		return codeFrame(text, this.loc.line, this.loc.column);
	}
}

export function codeFrame(text: string, lineNum: number, colNum: number): string {
	const lines = text.split(/\r\n|\n/);
	const maxLineNumLen = lines.length.toString().length + 1;
	let out = "";
	let n = 1;
	for (const line of lines) {
		if (Math.abs(n - lineNum) > 3) {
			n++;
			continue;
		}
		out += `${n == lineNum ? '>' : ' '}${n.toString().padStart(maxLineNumLen, ' ')} | ${tabToSpaces(line)}\n`;
		if (n == lineNum) {
			out += ` ${" ".repeat(maxLineNumLen)} | ${strToSpaces(line.substring(0, colNum - 1))}^\n`;
		}
		n++;
	}
	return out;
}

export function getLocByOffset(text: string, offset: number): VkpLocation {
	let line = 1;
	let column = 1;
	for (let i = 0; i < text.length; i++) {
		const c = text.charAt(i);
		if (c == "\n") {
			column = 1;
			line++;
		}
		if (i == offset)
			return { line, column };
	}
	return { line, column: 1 };
}

function strToSpaces(line: string): string {
	return tabToSpaces(line).replace(/./g, ' ');
}

function tabToSpaces(line: string): string {
	let newStr = "";
	let virtualSymbols = 0;
	for (let i = 0; i < line.length; i++) {
		const c = line.charAt(i);
		if (c == "\t") {
			const spacesCnt = 4 - virtualSymbols % 4;
			newStr += " ".repeat(spacesCnt);
			virtualSymbols += spacesCnt;
		} else {
			virtualSymbols++;
			newStr += c;
		}
	}
	return newStr;
}
