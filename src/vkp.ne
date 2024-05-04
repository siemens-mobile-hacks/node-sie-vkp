@preprocessor esmodule

@{%
import moo from 'moo';
import iconv from 'iconv-lite';
import { VkpParseError } from './VkpParseError.js';

// Set to true for https://omrelli.ug/nearley-playground/
const TEST_MODE = false;

const RE_PLACEHOLDERS = [
	/(?:0x)?(?:[a-fA-F0-9]*(?:XX|xx|YY|yy|ZZ|zz|HH|hh|nn|NN|Nn|MS|ML|\?\?)[a-fA-F0-9]*)+(?!\w)/,
	/(?:0i[+-]?)(?:[0-9]*(?:[xyz?]+)[0-9]*)+(?!\w)/
];

const lexer = moo.compile({
	WHITESPACE:				/[ \t]+/,
	PRAGMA:					{ match: /#pragma[ \t\w]+/, value: parsePragma, lineBreaks: false },
	COMMENT:				/(?:\/\/|;|#).*?$/,
	OFFSET:					{ match: /[+-](?:0[xX])?[a-fA-F0-9]+/, value: parseOffset, lineBreaks: false },
	ADDRESS:				{ match: /(?:0[xX])?[a-fA-F0-9]+:/, value: parseAddress, lineBreaks: false },
	NUMBER:					{ match: [/0x[a-fA-F0-9]+(?:\b|$)/, /0n[10]+(?:\b|$)/, /0i[+-]?[0-9]+(?!\w)/], value: parseAnyNumber, lineBreaks: false },
	DATA:					{ match: /[a-fA-F0-9]+\b/, value: parseHexData, lineBreaks: false },
	PLACEHOLDER:			{ match: RE_PLACEHOLDERS, value: parsePlaceholder, lineBreaks: false },
	STRING:					{ match: /(?:"(?:\\[^]|[^"\\])*?"|'(?:\\[^]|[^"\\])*?')/, value: parseString, lineBreaks: true },
	COMMA:					',',
	LINE_ESCAPE:			/\\(?:\r\n|\n)/,
	MULTILINE_COMMENT:		{ match: /\/\*[^]*?\*\//, lineBreaks: true },
	UNFINISHED_COMMENT:		{ match: /\/\*[^]*$/, lineBreaks: true },
	TRAILING_COMMENT_END:	/\*\//,
	NEWLINE:				{ match: /(?:\r\n|\n)/, lineBreaks: true },
	ERROR:					{ match: /.+?$/, lineBreaks: false }
});

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
	"a":	"\a",
	"b":	"\b",
	"t":	"\t",
	"r":	"\r",
	"n":	"\n",
	"v":	"\v",
	"f":	"\f",
	"e":	"\x1B",
};

function parseAnyNumber(v) {
	let m;

	if (TEST_MODE)
		return v;

	let tmpBuffer = Buffer.alloc(8);

	if ((m = v.match(/^0i([+-]\d+)$/i))) { // dec signed
		let num = m[1];
		for (let d of SINT_PARSER_DATA) {
			if ((num.length - 1) <= d[0]) {
				let parsedNum = BigInt(num);
				if (parsedNum < -d[1] || parsedNum > d[1]) {
					let loc = { line: lexer.line, column: lexer.col };
					return new VkpParseError(`Number ${v} exceeds allowed range -${d[1].toString(10)} ... +${d[1].toString(10)}.`, loc);
				}
				tmpBuffer.writeBigUInt64LE(BigInt.asUintN(d[2], parsedNum), 0);
				return tmpBuffer.slice(0, d[2] / 8);
			}
		}
	} else if ((m = v.match(/^0i(\d+)$/i))) { // dec unsigned
		let num = m[1];
		for (let d of UINT_PARSER_DATA) {
			if (num.length <= d[0]) {
				let parsedNum = d[2] <= 32 ? parseInt(num, 10) : BigInt(num);
				if (parsedNum < 0 || parsedNum > d[1]) {
					let loc = { line: lexer.line, column: lexer.col };
					return new VkpParseError(`Number ${v} exceeds allowed range 0 ... ${d[1].toString(10)}.`, loc);
				}

				if (d[2] <= 32) {
					tmpBuffer.writeUInt32LE(parsedNum, 0);
					return tmpBuffer.slice(0, d[2] / 8);
				} else {
					tmpBuffer.writeBigUInt64LE(parsedNum, 0);
					return tmpBuffer.slice(0, d[2] / 8);
				}
			}
		}
	} else if ((m = v.match(/^0x([a-f0-9]+)$/i))) { // hex unsigned
		let hexnum = m[1];
		if (hexnum.length % 2)
			hexnum = "0" + hexnum;
		if (hexnum.length > 8) {
			let loc = { line: lexer.line, column: lexer.col };
			return new VkpParseError(`Number ${v} exceeds allowed range 0x00000000 ... 0xFFFFFFFF.`, loc);
		}
		let number = parseInt(`0x${hexnum}`, 16);
		tmpBuffer.writeUInt32LE(number, 0);
		return tmpBuffer.slice(0, Math.ceil(hexnum.length / 2));
	} else if ((m = v.match(/^0n([10]+)$/i))) { // binary unsigned
		if (m[1].length > 32) {
			let loc = { line: lexer.line, column: lexer.col };
			return new VkpParseError(`Number ${v} exceeds allowed range 0n0 ... 0n11111111111111111111111111111111.`, loc);
		}
		let number = parseInt(m[1], 2);
		tmpBuffer.writeUInt32LE(number, 0);
		return tmpBuffer.slice(0, Math.ceil(m[1].length / 8));
	}

	let loc = { line: lexer.line, column: lexer.col };
	return new VkpParseError(`Invalid number: ${v}`, loc);
}

function parsePlaceholder(value) {
	let m;
	if ((m = value.match(/^(0i|0x|0n)(.*?)$/i))) {
		return parseAnyNumber(m[1] + m[2].replace(/[^0-9a-f]/gi, '0'));
	} else {
		return parseHexData(value.replace(/[^0-9a-f]/gi, '0'));
	}
}

function parseString(value) {
	if (TEST_MODE)
		return value;

	let m;
	if ((m = value.match(/(\/\*|\*\/|\/\/)/))) {
		let loc = { line: lexer.line, column: lexer.col };
		return new VkpParseError(`Unescaped ${m[1]} is not allowed in string: ${value}`, loc);
	}

	let text = value.slice(1, -1);

	let decoded = Buffer.alloc(value.length);
	let offset = 0;
	let parts = [];
	let tmp = "";
	let unicode = (value.charAt(0) == "'");

	let breakpoint = () => {
		if (tmp.length) {
			parts.push(tmp);
			tmp = "";
		}
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
						parts.push(Buffer.from([ hexnum ]));
					}
					i += 2;
				} else {
					tmp += c;
				}
			} else if (c == "u") {
				let hex = text.substr(i + 1, 4);
				if (hex.length == 4) {
					breakpoint();
					let hexnum = parseInt(`0x${hex}`);
					if (unicode) {
						parts.push(Buffer.from([ hexnum & 0xFF, (hexnum >> 8) & 0xFF ]));
					} else {
						parts.push(Buffer.from([ hexnum & 0xFF ]));
					}
					i += 4;
				} else {
					tmp += c;
				}
			} else if ((c in STR_ESCAPE_TABLE)) {
				tmp += STR_ESCAPE_TABLE[c];
			} else {
				tmp += c;
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

function parseOffset(v) {
	if (TEST_MODE)
		return v;

	let result = parseInt(v.replace(/^([+-])(0x)?/i, '$10x'), 16);
	if (isNaN(result)) {
		let loc = { line: lexer.line, column: lexer.col };
		return new VkpParseError(`Invalid offset: ${v.replace(/^([+-])(0x)?/i, '$10x')}`, loc);
	}
	return result;
}

function parseAddress(v) {
	if (TEST_MODE)
		return v;

	let result = parseInt(v.replace(/^(0x)?(.*?):$/i, '0x$2'), 16);
	if (isNaN(result)) {
		let loc = { line: lexer.line, column: lexer.col };
		return new VkpParseError(`Invalid address: ${v}`, loc);
	}
	return result;
}

function parseHexData(v) {
	if (TEST_MODE)
		return v;

	if (v.length % 2 != 0) {
		let loc = { line: lexer.line, column: lexer.col };
		return new VkpParseError(`Hex data (${v}) must be even length`, loc);
	}
	return TEST_MODE ? v : Buffer.from(v, "hex");
}

function parsePragma(v) {
	if (TEST_MODE)
		return v;

	let m;
	if (!(m = v.trim().match(/^#pragma\s+(enable|disable)\s+(warn_no_old_on_apply|warn_if_new_exist_on_apply|warn_if_old_exist_on_undo|undo|old_equal_ff)$/))) {
		let loc = { line: lexer.line, column: lexer.col };
		return new VkpParseError(`Invalid PRAGMA: ${v}`, loc);
	}
	return { name: m[2], action: m[1] };
}

function extractList(d) {
	let list = [d[0]];
	for (let i = 0; i < d[1].length; i++) {
		list.push(d[1][i][1]);
	}
	return list;
}

function skip() {
	return null;
}

function extractData(d) {
	if (!d)
		return null;
	return d.map((r) => r[0]);
}

function extractRecord(d) {
	if (d[4]) {
		return { type: "RECORD", address: d[0], old: extractData(d[2]), new: extractData(d[4]) };
	} else {
		return { type: "RECORD", address: d[0], old: [], new: extractData(d[2]) };
	}
}

function extractExpr(d) {
	let expr = d[1][0];
	let before = d[0];
	let after = d[2];

	if (expr.type == "RECORD" && expr.new.length > 0) {
		let lastTokenInData = expr.new[expr.new.length - 1];
		if (lastTokenInData.type == "NUMBER") {
			if (after && after[0].length > 0 && after[0][0] != null)
				expr.value = new VkpParseError(`No whitespace between number and comment`, { line: after[0][0].line, column: after[0][0].col });
		}
	}

	expr.before = before ? before[0].filter((e) => e != null) : [];
	expr.after = after ? after[0].filter((e) => e != null) : [];
	return expr;
}

function extractEmptyExpr(d) {
	let comments = filterNull(d);
	return comments ? { type: "COMMENTS", comments } : null;
}

function filterNull(d) {
	let ret = d[0].filter((expr) => expr != null);
	return ret.length ? ret : null;
}

%}

@lexer lexer

patch			-> expressions {% (d) => filterNull(d) || [] %}
expressions		-> expr_or_empty (%NEWLINE expr_or_empty):* {% extractList %}
expr_or_empty	-> expr {% id %} | empty_expr {% id %} | null {% skip %}
expr			-> before_expr (record_full | record_lite | %PRAGMA | %OFFSET | %ERROR) after_expr {% extractExpr %}

before_expr		-> (%MULTILINE_COMMENT {% id %} | SP {% skip %}):*
after_expr		-> (%MULTILINE_COMMENT {% id %} | %UNFINISHED_COMMENT {% id %} | %COMMENT {% id %} | SP {% skip %}):*
empty_expr		-> (
					%MULTILINE_COMMENT {% id %}
					| %UNFINISHED_COMMENT {% id %}
					| %COMMENT {% id %}
					| %TRAILING_COMMENT_END {% id %}
					| SP {% skip %}
				):+ {% extractEmptyExpr %}

DS				-> (%COMMA | %LINE_ESCAPE):+ {% skip %}
RS				-> %WHITESPACE (%LINE_ESCAPE SP:?):* {% skip %}
SP				-> %WHITESPACE {% skip %}

old_data		-> old_data_item (DS old_data_item):* {% extractList %}
old_data_item	-> %DATA | %NUMBER | %STRING

new_data		-> new_data_item (DS:? new_data_item):* {% extractList %}
new_data_item	-> %DATA | %NUMBER | %STRING | %PLACEHOLDER

record_full		-> %ADDRESS RS:? old_data RS new_data {% extractRecord %}
record_lite		-> %ADDRESS RS:? new_data {% extractRecord %}
