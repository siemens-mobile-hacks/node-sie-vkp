// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
function id(x) {
	return x[0];
}

import { lexer } from "./lexer.js";

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
	if (!d) return null;
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
			if (after && after[0].length > 0 && after[0][0] != null) expr.value = new VkpParseError(`No whitespace between number and comment`, { line: after[0][0].line, column: after[0][0].col });
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

let Lexer = lexer;
let ParserRules = [
	{ name: "patch", symbols: ["expressions"], postprocess: (d) => filterNull(d) || [] },
	{ name: "expressions$ebnf$1", symbols: [] },
	{ name: "expressions$ebnf$1$subexpression$1", symbols: [lexer.has("NEWLINE") ? { type: "NEWLINE" } : NEWLINE, "expr_or_empty"] },
	{
		name: "expressions$ebnf$1",
		symbols: ["expressions$ebnf$1", "expressions$ebnf$1$subexpression$1"],
		postprocess: function arrpush(d) {
			return d[0].concat([d[1]]);
		}
	},
	{ name: "expressions", symbols: ["expr_or_empty", "expressions$ebnf$1"], postprocess: extractList },
	{ name: "expr_or_empty", symbols: ["expr"], postprocess: id },
	{ name: "expr_or_empty", symbols: ["empty_expr"], postprocess: id },
	{ name: "expr_or_empty", symbols: [], postprocess: skip },
	{ name: "expr$subexpression$1", symbols: ["record_full"] },
	{ name: "expr$subexpression$1", symbols: ["record_lite"] },
	{ name: "expr$subexpression$1", symbols: [lexer.has("PRAGMA") ? { type: "PRAGMA" } : PRAGMA] },
	{ name: "expr$subexpression$1", symbols: [lexer.has("OFFSET") ? { type: "OFFSET" } : OFFSET] },
	{ name: "expr$subexpression$1", symbols: [lexer.has("ERROR") ? { type: "ERROR" } : ERROR] },
	{ name: "expr", symbols: ["before_expr", "expr$subexpression$1", "after_expr"], postprocess: extractExpr },
	{ name: "before_expr$ebnf$1", symbols: [] },
	{ name: "before_expr$ebnf$1$subexpression$1", symbols: [lexer.has("MULTILINE_COMMENT") ? { type: "MULTILINE_COMMENT" } : MULTILINE_COMMENT], postprocess: id },
	{ name: "before_expr$ebnf$1$subexpression$1", symbols: ["SP"], postprocess: skip },
	{
		name: "before_expr$ebnf$1",
		symbols: ["before_expr$ebnf$1", "before_expr$ebnf$1$subexpression$1"],
		postprocess: function arrpush(d) {
			return d[0].concat([d[1]]);
		}
	},
	{ name: "before_expr", symbols: ["before_expr$ebnf$1"] },
	{ name: "after_expr$ebnf$1", symbols: [] },
	{ name: "after_expr$ebnf$1$subexpression$1", symbols: [lexer.has("MULTILINE_COMMENT") ? { type: "MULTILINE_COMMENT" } : MULTILINE_COMMENT], postprocess: id },
	{ name: "after_expr$ebnf$1$subexpression$1", symbols: [lexer.has("UNFINISHED_COMMENT") ? { type: "UNFINISHED_COMMENT" } : UNFINISHED_COMMENT], postprocess: id },
	{ name: "after_expr$ebnf$1$subexpression$1", symbols: [lexer.has("COMMENT") ? { type: "COMMENT" } : COMMENT], postprocess: id },
	{ name: "after_expr$ebnf$1$subexpression$1", symbols: ["SP"], postprocess: skip },
	{
		name: "after_expr$ebnf$1",
		symbols: ["after_expr$ebnf$1", "after_expr$ebnf$1$subexpression$1"],
		postprocess: function arrpush(d) {
			return d[0].concat([d[1]]);
		}
	},
	{ name: "after_expr", symbols: ["after_expr$ebnf$1"] },
	{ name: "empty_expr$ebnf$1$subexpression$1", symbols: [lexer.has("MULTILINE_COMMENT") ? { type: "MULTILINE_COMMENT" } : MULTILINE_COMMENT], postprocess: id },
	{ name: "empty_expr$ebnf$1$subexpression$1", symbols: [lexer.has("UNFINISHED_COMMENT") ? { type: "UNFINISHED_COMMENT" } : UNFINISHED_COMMENT], postprocess: id },
	{ name: "empty_expr$ebnf$1$subexpression$1", symbols: [lexer.has("COMMENT") ? { type: "COMMENT" } : COMMENT], postprocess: id },
	{ name: "empty_expr$ebnf$1$subexpression$1", symbols: [lexer.has("TRAILING_COMMENT_END") ? { type: "TRAILING_COMMENT_END" } : TRAILING_COMMENT_END], postprocess: id },
	{ name: "empty_expr$ebnf$1$subexpression$1", symbols: ["SP"], postprocess: skip },
	{ name: "empty_expr$ebnf$1", symbols: ["empty_expr$ebnf$1$subexpression$1"] },
	{ name: "empty_expr$ebnf$1$subexpression$2", symbols: [lexer.has("MULTILINE_COMMENT") ? { type: "MULTILINE_COMMENT" } : MULTILINE_COMMENT], postprocess: id },
	{ name: "empty_expr$ebnf$1$subexpression$2", symbols: [lexer.has("UNFINISHED_COMMENT") ? { type: "UNFINISHED_COMMENT" } : UNFINISHED_COMMENT], postprocess: id },
	{ name: "empty_expr$ebnf$1$subexpression$2", symbols: [lexer.has("COMMENT") ? { type: "COMMENT" } : COMMENT], postprocess: id },
	{ name: "empty_expr$ebnf$1$subexpression$2", symbols: [lexer.has("TRAILING_COMMENT_END") ? { type: "TRAILING_COMMENT_END" } : TRAILING_COMMENT_END], postprocess: id },
	{ name: "empty_expr$ebnf$1$subexpression$2", symbols: ["SP"], postprocess: skip },
	{
		name: "empty_expr$ebnf$1",
		symbols: ["empty_expr$ebnf$1", "empty_expr$ebnf$1$subexpression$2"],
		postprocess: function arrpush(d) {
			return d[0].concat([d[1]]);
		}
	},
	{ name: "empty_expr", symbols: ["empty_expr$ebnf$1"], postprocess: extractEmptyExpr },
	{ name: "DS$ebnf$1$subexpression$1", symbols: [lexer.has("COMMA") ? { type: "COMMA" } : COMMA] },
	{ name: "DS$ebnf$1$subexpression$1", symbols: [lexer.has("LINE_ESCAPE") ? { type: "LINE_ESCAPE" } : LINE_ESCAPE] },
	{ name: "DS$ebnf$1", symbols: ["DS$ebnf$1$subexpression$1"] },
	{ name: "DS$ebnf$1$subexpression$2", symbols: [lexer.has("COMMA") ? { type: "COMMA" } : COMMA] },
	{ name: "DS$ebnf$1$subexpression$2", symbols: [lexer.has("LINE_ESCAPE") ? { type: "LINE_ESCAPE" } : LINE_ESCAPE] },
	{
		name: "DS$ebnf$1",
		symbols: ["DS$ebnf$1", "DS$ebnf$1$subexpression$2"],
		postprocess: function arrpush(d) {
			return d[0].concat([d[1]]);
		}
	},
	{ name: "DS", symbols: ["DS$ebnf$1"], postprocess: skip },
	{ name: "RS$ebnf$1", symbols: [] },
	{ name: "RS$ebnf$1$subexpression$1$ebnf$1", symbols: ["SP"], postprocess: id },
	{
		name: "RS$ebnf$1$subexpression$1$ebnf$1",
		symbols: [],
		postprocess: function (d) {
			return null;
		}
	},
	{ name: "RS$ebnf$1$subexpression$1", symbols: [lexer.has("LINE_ESCAPE") ? { type: "LINE_ESCAPE" } : LINE_ESCAPE, "RS$ebnf$1$subexpression$1$ebnf$1"] },
	{
		name: "RS$ebnf$1",
		symbols: ["RS$ebnf$1", "RS$ebnf$1$subexpression$1"],
		postprocess: function arrpush(d) {
			return d[0].concat([d[1]]);
		}
	},
	{ name: "RS", symbols: [lexer.has("WHITESPACE") ? { type: "WHITESPACE" } : WHITESPACE, "RS$ebnf$1"], postprocess: skip },
	{ name: "SP", symbols: [lexer.has("WHITESPACE") ? { type: "WHITESPACE" } : WHITESPACE], postprocess: skip },
	{ name: "old_data$ebnf$1", symbols: [] },
	{ name: "old_data$ebnf$1$subexpression$1", symbols: ["DS", "old_data_item"] },
	{
		name: "old_data$ebnf$1",
		symbols: ["old_data$ebnf$1", "old_data$ebnf$1$subexpression$1"],
		postprocess: function arrpush(d) {
			return d[0].concat([d[1]]);
		}
	},
	{ name: "old_data", symbols: ["old_data_item", "old_data$ebnf$1"], postprocess: extractList },
	{ name: "old_data_item", symbols: [lexer.has("DATA") ? { type: "DATA" } : DATA] },
	{ name: "old_data_item", symbols: [lexer.has("NUMBER") ? { type: "NUMBER" } : NUMBER] },
	{ name: "old_data_item", symbols: [lexer.has("STRING") ? { type: "STRING" } : STRING] },
	{ name: "new_data$ebnf$1", symbols: [] },
	{ name: "new_data$ebnf$1$subexpression$1$ebnf$1", symbols: ["DS"], postprocess: id },
	{
		name: "new_data$ebnf$1$subexpression$1$ebnf$1",
		symbols: [],
		postprocess: function (d) {
			return null;
		}
	},
	{ name: "new_data$ebnf$1$subexpression$1", symbols: ["new_data$ebnf$1$subexpression$1$ebnf$1", "new_data_item"] },
	{
		name: "new_data$ebnf$1",
		symbols: ["new_data$ebnf$1", "new_data$ebnf$1$subexpression$1"],
		postprocess: function arrpush(d) {
			return d[0].concat([d[1]]);
		}
	},
	{ name: "new_data", symbols: ["new_data_item", "new_data$ebnf$1"], postprocess: extractList },
	{ name: "new_data_item", symbols: [lexer.has("DATA") ? { type: "DATA" } : DATA] },
	{ name: "new_data_item", symbols: [lexer.has("NUMBER") ? { type: "NUMBER" } : NUMBER] },
	{ name: "new_data_item", symbols: [lexer.has("STRING") ? { type: "STRING" } : STRING] },
	{ name: "new_data_item", symbols: [lexer.has("PLACEHOLDER") ? { type: "PLACEHOLDER" } : PLACEHOLDER] },
	{ name: "record_full$ebnf$1", symbols: ["RS"], postprocess: id },
	{
		name: "record_full$ebnf$1",
		symbols: [],
		postprocess: function (d) {
			return null;
		}
	},
	{ name: "record_full", symbols: [lexer.has("ADDRESS") ? { type: "ADDRESS" } : ADDRESS, "record_full$ebnf$1", "old_data", "RS", "new_data"], postprocess: extractRecord },
	{ name: "record_lite$ebnf$1", symbols: ["RS"], postprocess: id },
	{
		name: "record_lite$ebnf$1",
		symbols: [],
		postprocess: function (d) {
			return null;
		}
	},
	{ name: "record_lite", symbols: [lexer.has("ADDRESS") ? { type: "ADDRESS" } : ADDRESS, "record_lite$ebnf$1", "new_data"], postprocess: extractRecord }
];
let ParserStart = "patch";
export default { Lexer, ParserRules, ParserStart };
