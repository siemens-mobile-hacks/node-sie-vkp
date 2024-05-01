import nearley from 'nearley';
import grammar from './grammar.js';
import { VkpParseError, getLocByOffset } from './VkpParseError.js';

const DEFAULT_PRAGMAS = {
	warn_no_old_on_apply:		true,
	warn_if_new_exist_on_apply:	true,
	warn_if_old_exist_on_undo:	true,
	undo:						true,
	old_equal_ff:				false,
};

function parseVKP(text, options) {
	options = {
		allowEmptyOldData:	false,
		allowPlaceholders:	false,
		...options
	};

	let vkp = {
		valid: false,
		writes: [],
		warnings: [],
		errors: [],
		needRecovery: false
	};

	let parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
	try {
		parser.feed(text);
		parser.finish();
	} catch (e) {
		let m;
		let loc = { line: 1, column: 1 };
		if (e.token) {
			loc = { line: e.token.line, column: e.token.col };
		} else if ((m = e.message.match(/at line (\d+) col (\d+)/))) {
			loc = { line: +m[1], column: +m[2] };
		}
		vkp.errors.push(new VkpParseError(`Invalid syntax`, loc));
		return vkp;
	}

	if (parser.results.length != 1) {
		vkp.errors.push(new VkpParseError(`Invalid parser results!`, { line: 1, column: 1 }));
		return vkp;
	}

	let pragmas = {...DEFAULT_PRAGMAS};
	let pragma2loc = {};
	let offsetCorrector = 0;
	let offsetCorrectorLoc;
	let offsetCorrectorNode;

	for (let n of parser.results[0]) {
		if ((n.value instanceof Error)) {
			vkp.errors.push(n.value);
			continue;
		}

		if (n.type == "COMMENTS") {
			// Ignore comments
		} else if (n.type == "ERROR") {
			let loc = { line: n.line, column: n.col };
			vkp.errors.push(new VkpParseError(`Syntax error`, loc));
		} else if (n.type == "OFFSET") {
			offsetCorrector = n.value;
			offsetCorrectorLoc = { line: n.line, column: n.col };
			offsetCorrectorNode = n;
		} else if (n.type == "PRAGMA") {
			let loc = { line: n.line, column: n.col };

			if (n.value.action == "enable") {
				if (pragmas[n.value.name]) {
					vkp.warnings.push(new VkpParseError(`Useless "#pragma ${n.value.action} ${n.value.name}" has no effect`, loc));
				} else {
					pragmas[n.value.name] = true;
					pragma2loc[n.value.name] = loc;
				}
			} else if (n.value.action == "disable") {
				if (!pragmas[n.value.name]) {
					vkp.warnings.push(new VkpParseError(`Useless "#pragma ${n.value.action} ${n.value.name}" has no effect`, loc));
				} else {
					pragma2loc[n.value.name] = loc;
					pragmas[n.value.name] = false;
				}
			}
		} else if (n.type == "RECORD") {
			let loc = { line: n.address.line, column: n.address.col };
			let oldDataloc = n.old.length ? { line: n.old[0].line, column: n.old[0].col } : loc;
			let newDataloc = n.new.length ? { line: n.new[0].line, column: n.new[0].col } : loc;

			// Check for errors
			let fatalErrors = 0;
			let isPlaceholder = false;

			for (let d of [n.old, n.new]) {
				for (let w of d) {
					if ((w.value instanceof Error)) {
						vkp.errors.push(w.value);
						fatalErrors++;
					} else if (w.type == "PLACEHOLDER") {
						isPlaceholder = true;
					}
				}
			}

			if (fatalErrors)
				break;

			let oldData = Buffer.concat(n.old.map((d) => d.value));
			let newData;

			if (isPlaceholder) {
				newData = null;
				if (!options.allowPlaceholders)
					vkp.errors.push(new VkpParseError(`Found placeholder instead of real patch data`, newDataloc));
			} else {
				newData = Buffer.concat(n.new.map((d) => d.value));

				if (pragmas.old_equal_ff) {
					oldData = Buffer.alloc(newData.length);
					oldData.fill(0xFF);
				}

				if (oldData.length > 0 && oldData.length < newData.length) {
					vkp.errors.push(new VkpParseError(`Old data (${oldData.length} bytes) is less than new data (${newData.length} bytes).`, oldDataloc));
					break;
				}

				if (pragmas.warn_no_old_on_apply && !oldData.length) {
					if (!options.allowEmptyOldData)
						vkp.warnings.push(new VkpParseError(`Old data is not specified, undo operation is impossible`, newDataloc));
					vkp.needRecovery = true;
				}
			}

			vkp.writes.push({
				addr:			offsetCorrector + n.address.value,
				old:			oldData,
				new:			newData,
				line:			n.address.line,
				placeholder:	isPlaceholder,
				pragmas:		{...pragmas}
			});
		} else {
			let loc = { line: n.line, column: n.col };
			vkp.errors.push(new VkpParseError(`Unexpected TOKEN: ${n.type}`, loc));
		}
	}

	let unsinishedPragmas = [];
	for (let k in pragmas) {
		if (pragmas[k] !== DEFAULT_PRAGMAS[k])
			vkp.warnings.push(new VkpParseError(`Uncanceled pragma "${k}"`, pragma2loc[k]));
	}

	vkp.valid = (vkp.errors.length == 0);

	if (offsetCorrector != 0)
		vkp.warnings.push(new VkpParseError(`Uncanceled offset ${offsetCorrectorNode.text}`, offsetCorrectorLoc));

	return vkp;
}

function detectVKPContent(text) {
	let trimmedText = text.replace(/\/\*.*?\*\//gs, '').replace(/(\/\/|;|#).*?$/mg, '');
	if (trimmedText.match(/^\s*(0x[a-f0-9]+|[a-f0-9]+)\s*:[^\\/]/mi))
		return "PATCH";
	if (!trimmedText.trim().length)
		return "EMPTY";
	if (text.match(/;!к патчу прикреплён файл, https?:\/\//i))
		return "DOWNLOAD_STUB";
	return "UNKNOWN";
}

export { parseVKP, detectVKPContent };
