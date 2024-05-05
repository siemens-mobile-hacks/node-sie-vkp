import moo from 'moo';
import iconv from 'iconv-lite';
import { VkpParseError } from './VkpParseError.js';

const RE_PLACEHOLDERS = [
	/(?:0x)?(?:[a-fA-F0-9]*(?:XX|xx|YY|yy|ZZ|zz|HH|hh|nn|NN|Nn|MS|ML|\?\?)[a-fA-F0-9]*)+(?!\w)/,
	/(?:0i[+-]?)(?:[0-9]*(?:[xyz?]+)[0-9]*)+(?!\w)/
];

export const TOKEN = {
	WHITESPACE:				1,
	PRAGMA:					2,
	COMMENT:				3,
	OFFSET:					4,
	ADDRESS:				5,
	NUMBER:					6,
	DATA:					7,
	PLACEHOLDER:			8,
	STRING:					9,
	COMMA:					10,
	LINE_ESCAPE:			11,
	MULTILINE_COMMENT:		12,
	UNFINISHED_COMMENT:		13,
	TRAILING_COMMENT_END:	14,
	NEWLINE:				15,
	ERROR:					16,
};

export const LEXER = moo.compile([
	{ type: TOKEN.WHITESPACE,				match: /[ \t]+/, lineBreaks: false },
	{ type: TOKEN.PRAGMA,					match: /#pragma[ \t\w]+/, lineBreaks: false },
	{ type: TOKEN.COMMENT,					match: /(?:\/\/|;|#).*?$/, lineBreaks: false },
	{ type: TOKEN.OFFSET,					match: /[+-](?:0[xX])?[a-fA-F0-9]+/, lineBreaks: false },
	{ type: TOKEN.ADDRESS,					match: /(?:0[xX])?[a-fA-F0-9]+:/, lineBreaks: false },
	{ type: TOKEN.NUMBER,					match: [/0x[a-fA-F0-9]+(?:\b|$)/, /0n[10]+(?:\b|$)/, /0i[+-]?[0-9]+(?!\w)/], lineBreaks: false },
	{ type: TOKEN.DATA,						match: /[a-fA-F0-9]+\b/, lineBreaks: false },
	{ type: TOKEN.PLACEHOLDER,				match: RE_PLACEHOLDERS, lineBreaks: false },
	{ type: TOKEN.STRING,					match: /(?:"(?:\\[^]|[^"\\])*?"|'(?:\\[^]|[^"\\])*?')/, lineBreaks: true },
	{ type: TOKEN.COMMA,					match: /,/, lineBreaks: false },
	{ type: TOKEN.LINE_ESCAPE,				match: /\\(?:\r\n|\n)/, lineBreaks: true },
	{ type: TOKEN.MULTILINE_COMMENT,		match: /\/\*[^]*?\*\//, lineBreaks: true },
	{ type: TOKEN.UNFINISHED_COMMENT,		match: /\/\*[^]*$/, lineBreaks: true },
	{ type: TOKEN.TRAILING_COMMENT_END,		match: /\*\//, lineBreaks: false },
	{ type: TOKEN.NEWLINE,					match: /(?:\r\n|\n)/, lineBreaks: true },
	{ type: TOKEN.ERROR,					match: /.+?$/, lineBreaks: false },
]);
