import iconv from 'iconv-lite';
import { LEXER, TOKEN } from './lexer.js';
import { VkpParseError } from './VkpParseError.js';

const UINT_PARSER_DATA = [
	[3,		0xFF,					8], // 1b
	[5,		0xFFFF,					16], // 2b
	[8,		0xFFFFFF,				24], // 3b
	[10,	0xFFFFFFFF,				32], // 4b
	[13,	0xFFFFFFFFFF,			40], // 5b
	[15,	0xFFFFFFFFFFFF,			48], // 6b
	[17,	0xFFFFFFFFFFFFFFn,		56], // 7b
	[20,	0xFFFFFFFFFFFFFFFFn,	64], // 8b
];

const SINT_PARSER_DATA = [
	[3,		0x7F,					8], // 1b
	[5,		0x7FFF,					16], // 2b
	[8,		0x7FFFFF,				24], // 3b
	[10,	0x7FFFFFFF,				32], // 4b
	[13,	0x7FFFFFFFFF,			40], // 5b
	[15,	0x7FFFFFFFFFFF,			48], // 6b
	[17,	0x7FFFFFFFFFFFFFn,		56], // 7b
	[20,	0x7FFFFFFFFFFFFFFFn,	64], // 8b
];

const STR_ESCAPE_TABLE = {
	"a":	"\x07",
	"b":	"\b",
	"t":	"\t",
	"r":	"\r",
	"n":	"\n",
	"v":	"\v",
	"f":	"\f",
	"e":	"\x1B",
	"\\":	"\\",
	"/":	"/",
	"*":	"*",
	"\"":	"\"",
	"'":	"'",
	"`":	"`",
	" ":	" ",
};

let state;

function noop() {

}

function vkpRawParser(text, options = {}) {
	options = {
		onPragma: noop,
		onPatchData: noop,
		onOffset: noop,
		onComments: noop,
		onWarning: noop,
		onError: noop,
		...options
	};

	state = {
		token:			null,
		prevToken:		null,
		warnings:		[],
		onPragma:		options.onPragma,
		onPatchData:	options.onPatchData,
		onOffset:		options.onOffset,
		onComments:		options.onComments,
		onWarning:		options.onWarning,
		onError:		options.onError,
	};

	LEXER.reset(text);

	let token;
	while ((token = peekToken())) {
		try {
			if (token.type == TOKEN.ADDRESS) {
				let loc = getLocation();
				state.onPatchData(parsePatchRecord(), loc);
			} else if (token.type == TOKEN.PRAGMA) {
				let loc = getLocation();
				state.onPragma(parsePatchPragma(), loc);
			} else if (token.type == TOKEN.OFFSET) {
				let loc = getLocation();
				state.onOffset(parsePatchOffsetCorrector(), loc);
			} else if (token.type == TOKEN.NEWLINE || token.type == TOKEN.WHITESPACE) {
				nextToken();
			} else if (token.type == TOKEN.COMMENT || token.type == TOKEN.MULTILINE_COMMENT || token.type == TOKEN.UNFINISHED_COMMENT) {
				let loc = getLocation();
				state.onComments(parseComments(), loc);
			} else if (token.type == TOKEN.TRAILING_COMMENT_END) {
				state.onWarning(new VkpParseError(`Trailing multiline comment end`, getLocation()));
				nextToken();
			} else {
				throw new VkpParseError("Syntax error", getLocation());
			}
		} catch (e) {
			let loc = getLocation();
			let token;
			while ((token = nextToken())) {
				if (token.type == TOKEN.NEWLINE)
					break;
			}
			state.onError(e, loc);
		}
	}

	state = null;
}

function parseComments() {
	let comments = [];
	let token;
	while ((token = peekToken())) {
		if (token.type == TOKEN.NEWLINE) {
			nextToken();
			break;
		} else if (token.type == TOKEN.WHITESPACE) {
			nextToken();
		} else if (token.type == TOKEN.COMMENT || token.type == TOKEN.MULTILINE_COMMENT || token.type == TOKEN.UNFINISHED_COMMENT) {
			if (token.type == TOKEN.UNFINISHED_COMMENT)
				state.onWarning(new VkpParseError(`Unfinished multiline comment`, getLocation()));
			comments.push(nextToken());
		} else {
			break;
		}
	}
	return comments;
}

function parsePatchPragma() {
	let pragma = parsePragmaValue(peekToken().value);
	nextToken();
	let comments = parseCommentsAfterExpr();
	return { pragma, comments };
}

function parsePatchOffsetCorrector() {
	let text = peekToken().value;
	let offset = parseOffsetValue(text);
	nextToken();
	let comments = parseCommentsAfterExpr();
	return { text, offset, comments };
}

function parsePatchRecord() {
	let address = parsePatchRecordAddress();

	let data = [];
	for (let i = 0; i < 2; i++) {
		if (!parsePatchRecordSeparator())
			break;
		let loc = getLocation();
		let [buffer, placeholders] = parsePatchData();
		data.push({ loc, buffer: mergeBuffers(buffer), placeholders });
	}

	if (!data.length)
		throw new VkpParseError(`Empty patch data record!`, getLocation());

	let comments = parseCommentsAfterExpr();
	return {
		address,
		comments,
		old:	data.length == 2 ? data[0] : null,
		new:	data.length == 2 ? data[1] : data[0],
	};
}

function mergeBuffers(buffers) {
	return buffers.length > 1 ? Buffer.concat(buffers) : buffers[0];
}

function parsePatchRecordAddress() {
	let value = parseAddressValue(peekToken().value);
	nextToken();
	return value;
}

function parsePatchData() {
	let data = [];
	let token;
	let placeholders = 0;
	while ((token = peekToken())) {
		if (token.type == TOKEN.COMMA) {
			nextToken();
		} else if (token.type == TOKEN.DATA) {
			data.push(parseHexDataValue(peekToken().value));
			nextToken();
		} else if (token.type == TOKEN.PLACEHOLDER) {
			data.push(parsePlaceholderValue(peekToken().value));
			nextToken();
			placeholders++;
		} else if (token.type == TOKEN.NUMBER) {
			data.push(parseAnyNumberValue(peekToken().value));
			nextToken();
		} else if (token.type == TOKEN.STRING) {
			data.push(parseStringValue(peekToken().value));
			nextToken();
		} else if (token.type == TOKEN.LINE_ESCAPE) {
			nextToken();
		} else if (token.type == TOKEN.WHITESPACE || token.type == TOKEN.NEWLINE) {
			break;
		} else if (token.type == TOKEN.COMMENT || token.type == TOKEN.MULTILINE_COMMENT || token.type == TOKEN.UNFINISHED_COMMENT) {
			if (prevToken().type == TOKEN.NUMBER)
				throw new VkpParseError(`No whitespace between number and comment`, getLocation());
			break;
		} else {
			throw new VkpParseError("Syntax error", getLocation());
		}
	}
	return [data, placeholders];
}

function parsePatchRecordSeparator() {
	let token;
	while ((token = peekToken())) {
		if (token.type == TOKEN.NEWLINE) {
			return false;
		} else if (token.type == TOKEN.DATA || token.type == TOKEN.PLACEHOLDER || token.type == TOKEN.NUMBER || token.type == TOKEN.STRING) {
			return true;
		} else if (token.type == TOKEN.COMMENT || token.type == TOKEN.MULTILINE_COMMENT || token.type == TOKEN.UNFINISHED_COMMENT) {
			return false;
		} else if (token.type == TOKEN.WHITESPACE || token.type == TOKEN.LINE_ESCAPE) {
			nextToken();
		} else {
			throw new VkpParseError("Syntax error", getLocation());
		}
	}
	return false;
}

function parseCommentsAfterExpr() {
	let comments = [];
	let token;
	while ((token = peekToken())) {
		if (token.type == TOKEN.NEWLINE) {
			nextToken();
			break;
		} else if (token.type == TOKEN.WHITESPACE) {
			nextToken();
		} else if (token.type == TOKEN.COMMENT || token.type == TOKEN.MULTILINE_COMMENT || token.type == TOKEN.UNFINISHED_COMMENT) {
			if (token.type == TOKEN.UNFINISHED_COMMENT)
				state.onWarning(new VkpParseError(`Unfinished multiline comment`, getLocation()));
			comments.push(nextToken());
		} else {
			throw new VkpParseError("Syntax error", getLocation());
		}
	}
	return comments;
}

function nextToken() {
	state.prevToken = state.token;
	let token = state.token ? state.token : LEXER.next();
	state.token = LEXER.next();
	return token;
}

function peekToken() {
	if (state.token == null)
		state.token = LEXER.next();
	return state.token;
}

function prevToken() {
	return state.prevToken;
}

/**
 * Token value parsers
 * */
function parseAnyNumberValue(v) {
	let m;
	let tmpBuffer = Buffer.allocUnsafe(8);

	if ((m = v.match(/^0i([+-]\d+)$/i))) { // dec signed
		let num = m[1];
		for (let d of SINT_PARSER_DATA) {
			if ((num.length - 1) <= d[0]) {
				let parsedNum = BigInt(num);
				if (parsedNum < -d[1] || parsedNum > d[1])
					throw new VkpParseError(`Number ${v} exceeds allowed range -${d[1].toString(10)} ... +${d[1].toString(10)}`, getLocation());
				if ((num.length - 1) < d[0] && d[0] > 3) {
					throw new VkpParseError(`The wrong number of digits in integer (${v})`, getLocation(),
						"Must be: 3 (for BYTE), 5 (for WORD), 8 (for 3 BYTES), 10 (for DWORD), 13 (for 5 BYTES), 15 (for 6 BYTES),  17 (for 7 BYTES), 20 (for 8 BYTES)." +
						"Use leading zeroes to match the number of digits.");
				}
				tmpBuffer.writeBigUInt64LE(BigInt.asUintN(d[2], parsedNum), 0);
				return tmpBuffer.subarray(0, d[2] / 8);
			}
		}
	} else if ((m = v.match(/^0i(\d+)$/i))) { // dec unsigned
		let num = m[1];
		for (let d of UINT_PARSER_DATA) {
			if (num.length <= d[0]) {
				let parsedNum = d[2] <= 32 ? parseInt(num, 10) : BigInt(num);
				if (parsedNum < 0 || parsedNum > d[1])
					throw new VkpParseError(`Number ${v} exceeds allowed range 0 ... ${d[1].toString(10)}`, getLocation());
				if (num.length < d[0] && d[0] > 3) {
					throw new VkpParseError(`The wrong number of digits in integer (${v})`, getLocation(),
						"Must be: 3 (for BYTE), 5 (for WORD), 8 (for 3 BYTES), 10 (for DWORD), 13 (for 5 BYTES), 15 (for 6 BYTES),  17 (for 7 BYTES), 20 (for 8 BYTES)." +
						"Use leading zeroes to match the number of digits.");
				}
				if (d[2] <= 32) {
					tmpBuffer.writeUInt32LE(parsedNum, 0);
					return tmpBuffer.subarray(0, d[2] / 8);
				} else {
					tmpBuffer.writeBigUInt64LE(parsedNum, 0);
					return tmpBuffer.subarray(0, d[2] / 8);
				}
			}
		}
	} else if ((m = v.match(/^0x([a-f0-9]+)$/i))) { // hex unsigned
		let hexnum = m[1];
		if (hexnum.length % 2)
			hexnum = "0" + hexnum;
		if (hexnum.length > 8)
			throw new VkpParseError(`Number ${v} exceeds allowed range 0x00000000 ... 0xFFFFFFFF`, getLocation());
		let number = parseInt(`0x${hexnum}`, 16);
		tmpBuffer.writeUInt32LE(number, 0);
		return tmpBuffer.subarray(0, Math.ceil(hexnum.length / 2));
	} else if ((m = v.match(/^0n([10]+)$/i))) { // binary unsigned
		if (m[1].length > 32)
			throw new VkpParseError(`Number ${v} exceeds allowed range 0n0 ... 0n11111111111111111111111111111111`, getLocation());
		let number = parseInt(m[1], 2);
		tmpBuffer.writeUInt32LE(number, 0);
		return tmpBuffer.subarray(0, Math.ceil(m[1].length / 8));
	}

	throw new VkpParseError(`Invalid number: ${v}`, getLocation());
}

function parsePlaceholderValue(value) {
	let m;
	if ((m = value.match(/^(0i|0x|0n)(.*?)$/i))) {
		return parseAnyNumberValue(m[1] + m[2].replace(/[^0-9a-f]/gi, '0'));
	} else {
		return parseHexDataValue(value.replace(/[^0-9a-f]/gi, '0'));
	}
}

function parseStringValue(value) {
	let m;
	if ((m = value.match(/(\/\*|\*\/|\/\/)/))) {
		throw new VkpParseError(`Unescaped ${m[1]} is not allowed in string: ${value}`, getLocation(),
			`Escape these ambiguous characters like this: \\/* or \\/\\/.`);
	}

	let text = value.slice(1, -1);

	let offset = 0;
	let parts = [];
	let tmp = "";
	let unicode = (value.charAt(0) == "'");
	let escape = false;

/*
	if (!unicode && value.match(/[^\u0000-\u007F]/)) {
		throw new VkpParseError(`ASCII string with non-ASCII characters`, getLocation(),
			`Please use only ASCII-safe characters from the range U+0000-U+007F or \\xNN escape sequences.`);
	}
*/

	let breakpoint = () => {
		if (tmp.length) {
			parts.push(tmp);
			tmp = "";
		}
	};

	let getStrLocation = (i) => {
		let loc = getLocation();
		loc.column += i;
		return loc;
	};

	for (let i = 0; i < text.length; i++) {
		let c = text.charAt(i);
		if (escape) {
			if (c == "\r") {
				if (text.charAt(i + 1) == "\n")
					i++;
			} else if (c == "\n") {
				// Ignore
			} else if (c == "x") {
				let hex = text.substr(i + 1, 2);
				if (hex.length == 2) {
					breakpoint();
					let hexnum = parseInt(`0x${hex}`);
					if (unicode) {
						parts.push(Buffer.from([ hexnum, 0x00 ]));
					} else {
						if (hexnum >= 0x7F && !unicode)
							throw new VkpParseError(`Bad escape sequence (\\x${hex})`, getStrLocation(i), `Allowed range: \\x00-\\x7F.`);
						parts.push(Buffer.from([ hexnum ]));
					}
					i += 2;
				} else {
					throw new VkpParseError(`Unknown escape sequence (\\x${hex})`, getStrLocation(i));
				}
			} else if (c == "u") {
				let hex = text.substr(i + 1, 4);
				if (hex.length == 4) {
					breakpoint();
					let hexnum = parseInt(`0x${hex}`);
					if (unicode) {
						parts.push(Buffer.from([ hexnum & 0xFF, (hexnum >> 8) & 0xFF ]));
					} else {
						throw new VkpParseError(`Unknown escape sequence (\\u${hex})`, getStrLocation(i));
					}
					i += 4;
				} else {
					throw new VkpParseError(`Unknown escape sequence (\\u${hex})`, getStrLocation(i));
				}
			} else if (c.match(/[0-7]/)) {
				let ocatlLen = 1;
				for (let j = 1; j < 3; j++) {
					if (!text.charAt(i + j).match(/[0-7]/))
						break;
					ocatlLen++;
				}

				let oct = parseInt(text.substr(i, ocatlLen), 8);
				if (oct > 0xFF)
					throw new VkpParseError(`Unknown escape sequence (\\${text.substr(i, ocatlLen)})`, getStrLocation(i));

				breakpoint();
				if (unicode) {
					parts.push(Buffer.from([ oct, 0x00 ]));
				} else {
					parts.push(Buffer.from([ oct ]));
				}

				i += ocatlLen - 1;
			} else if ((c in STR_ESCAPE_TABLE)) {
				tmp += STR_ESCAPE_TABLE[c];
			} else {
				throw new VkpParseError(`Unknown escape sequence (\\${c})`, getStrLocation(i));
			}
			escape = false;
		} else {
			if (c == '\\') {
				escape = true;
			} else {
				tmp += c;
			}
		}
	}

	breakpoint();

	if (unicode) {
		return Buffer.concat(parts.map((p) => typeof p === "string" ? iconv.encode(p, 'utf-16', { addBOM: false }) : p));
	} else {
		return Buffer.concat(parts.map((p) => typeof p === "string" ? iconv.encode(p, 'windows-1251') : p));
	}
}

function parseOffsetValue(v) {
	let result = parseInt(v.replace(/^([+-])(0x)?/i, '$10x'), 16);
	if (isNaN(result))
		throw new VkpParseError(`Invalid offset: ${v}`, getLocation());
	if (result > 0xFFFFFFFF)
		throw new VkpParseError(`Offset ${v} exceeds allowed range 00000000 ... FFFFFFFF`, getLocation());
	return result;
}

function parseAddressValue(v) {
	let result = parseInt(v.replace(/^(0x)?(.*?):$/i, '0x$2'), 16);
	if (isNaN(result))
		throw new VkpParseError(`Invalid address: ${v}`, getLocation());
	if (result > 0xFFFFFFFF)
		throw new VkpParseError(`Address ${v} exceeds allowed range 00000000 ... FFFFFFFF`, getLocation());
	return result;
}

function parseHexDataValue(v) {
	if (v.length % 2 != 0)
		throw new VkpParseError(`Hex data (${v}) must be even length`, getLocation());
	return Buffer.from(v, "hex");
}

function parsePragmaValue(v) {
	let m;
	if (!(m = v.trim().match(/^#pragma\s+(enable|disable)\s+(warn_no_old_on_apply|warn_if_new_exist_on_apply|warn_if_old_exist_on_undo|undo|old_equal_ff)$/)))
		throw new VkpParseError(`Invalid PRAGMA: ${v}`, getLocation());
	return { name: m[2], action: m[1] };
}

function getLocation() {
	return state.token ? { line: state.token.line, column: state.token.col } : { line: 1, column: 1 };
}

export { vkpRawParser };
