export class VkpParseError extends Error {
	loc;
	constructor(message, loc) {
		super(`${message} at line ${loc.line} col ${loc.column}`);
		this.name = "VkpParseError";
		this.loc = loc;
	}

	codeFrame(text) {
		return codeFrame(text, this.loc.line, this.loc.column);
	}
};

export function codeFrame(text, lineNum, colNum) {
	let lines = text.split(/\r\n|\n/);
	let maxLineNumLen = lines.length.toString().length + 1;
	let out = "";
	let n = 1;
	for (let line of lines) {
		if (Math.abs(n - lineNum) > 3) {
			n++;
			continue;
		}
		out += `${n == lineNum ? '>' : ' '}${n.toString().padStart(maxLineNumLen, ' ')} | ${line}\n`;
		if (n == lineNum) {
			out += ` ${" ".repeat(maxLineNumLen, ' ')} | ${" ".repeat(colNum - 1)}^\n`;
		}
		n++;
	}
	return out;
}

export function getLocByOffset(text, offset) {
	let line = 0;
	let column = 1;
	for (let i = 0; i < text.length; i++) {
		let c = text.charAt(i);
		if (c == "\n" || (c == "\r" && text.charAt(i + 1) == "\n")) {
			column = 1;
			line++;
		}
		if (i == offset)
			return { line, column };
	}
	return { line, column: 1 };
}
