import moo from "moo";

const RE_PLACEHOLDERS: RegExp[] = [
	/(?:0x)?(?:[a-fA-F0-9]*(?:XX|xx|YY|yy|ZZ|zz|HH|hh|nn|NN|Nn|MS|ML|\?\?)[a-fA-F0-9]*)+(?!\w)/,
	/0i[+-]?(?:[0-9]*[xyz?]+[0-9]*)+(?!\w)/
];

export type VkpTokenType = 'WHITESPACE' | 'PRAGMA' | 'COMMENT' |
	'OFFSET' | 'ADDRESS' | 'NUMBER' | 'DATA' | 'PLACEHOLDER' |
	'STRING' | 'COMMA' | 'LINE_ESCAPE' | 'MULTILINE_COMMENT' |
	'UNFINISHED_COMMENT' | 'TRAILING_COMMENT_END' | 'NEWLINE' | 'ERROR';

export const VkpLexer = moo.compile({
	WHITESPACE: { match: /[ \t]+/, lineBreaks: false },
	PRAGMA: { match: /#pragma[ \t\w]+/, lineBreaks: false },
	COMMENT: { match: /(?:\/\/|;|#).*?$/, lineBreaks: false },
	OFFSET: { match: /[+-](?:0[xX])?[a-fA-F0-9]+/, lineBreaks: false },
	ADDRESS: { match: /(?:0[xX])?[a-fA-F0-9]+:/, lineBreaks: false },
	NUMBER: { match: [/0x[a-fA-F0-9]+(?:\b|$)/, /0n[10]+(?:\b|$)/, /0i[+-]?[0-9]+(?!\w)/], lineBreaks: false },
	DATA: { match: /[a-fA-F0-9]+\b/, lineBreaks: false },
	PLACEHOLDER: { match: RE_PLACEHOLDERS, lineBreaks: false },
	STRING: { match: /"(?:\\[^]|[^"\\])*?"|'(?:\\[^]|[^"\\])*?'/, lineBreaks: true },
	COMMA: { match: /,/, lineBreaks: false },
	LINE_ESCAPE: { match: /\\(?:\r\n|\n)/, lineBreaks: true },
	MULTILINE_COMMENT: { match: /\/\*[^]*?\*\//, lineBreaks: true },
	UNFINISHED_COMMENT: { match: /\/\*[^]*$/, lineBreaks: true },
	TRAILING_COMMENT_END: { match: /\*\//, lineBreaks: false },
	NEWLINE: { match: /\r\n|\n/, lineBreaks: true },
	ERROR: { match: /.+?$/, lineBreaks: false },
});
