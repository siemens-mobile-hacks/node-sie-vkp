export class VkpParseError extends Error {
	loc;
	hint;
	constructor(message, loc, hint) {
		super(`${message} at line ${loc.line} col ${loc.column}${hint ? "\n" + hint : ""}`);
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
		out += `${n == lineNum ? '>' : ' '}${n.toString().padStart(maxLineNumLen, ' ')} | ${tab2spaces(line)}\n`;
		if (n == lineNum) {
			out += ` ${" ".repeat(maxLineNumLen, ' ')} | ${str2spaces(line.substr(0, colNum - 1))}^\n`;
		}
		n++;
	}
	return out;
}

export function getLocByOffset(text, offset) {
	let line = 1;
	let column = 1;
	for (let i = 0; i < text.length; i++) {
		let c = text.charAt(i);
		if (c == "\n") {
			column = 1;
			line++;
		}
		if (i == offset)
			return { line, column };
	}
	return { line, column: 1 };
}

function str2spaces(line) {
	return tab2spaces(line).replace(/./g, ' ');
}

function tab2spaces(line) {
	let newStr = "";
	let virtualSymbols = 0;
	for (let i = 0; i < line.length; i++) {
		let c = line.charAt(i);
		if (c == "\t") {
			let spacesCnt = 4 - virtualSymbols % 4;
			newStr += " ".repeat(spacesCnt);
			virtualSymbols += spacesCnt;
		} else {
			virtualSymbols++;
			newStr += c;
		}
	}
	return newStr;
}
