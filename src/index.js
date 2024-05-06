import iconv from 'iconv-lite';
import { vkpRawParser } from './parser.js';
import { VkpParseError } from './VkpParseError.js';
import RTFParser from 'rtf-parser';

const DEFAULT_PRAGMAS = {
	warn_no_old_on_apply:		true,
	warn_if_new_exist_on_apply:	true,
	warn_if_old_exist_on_undo:	true,
	undo:						true,
	old_equal_ff:				false,
};

function vkpParse(text, options) {
	options = {
		allowEmptyOldData:	false,
		allowPlaceholders:	false,
		...options
	};

	let vkp = {
		ast: null,
		valid: false,
		writes: [],
		warnings: [],
		errors: [],
	};

	let pragmas = {...DEFAULT_PRAGMAS};
	let pragma2loc = {};
	let offsetCorrector;

	vkpRawParser(text, {
		onPragma(value, loc) {
			if (value.pragma.action == "enable") {
				if (pragmas[value.pragma.name]) {
					vkp.warnings.push(new VkpParseError(`Useless "#pragma ${value.pragma.action} ${value.pragma.name}" has no effect`, loc, `You can safely remove this line.`));
				} else {
					pragmas[value.pragma.name] = true;
					pragma2loc[value.pragma.name] = loc;
				}
			} else if (value.pragma.action == "disable") {
				if (!pragmas[value.pragma.name]) {
					vkp.warnings.push(new VkpParseError(`Useless "#pragma ${value.pragma.action} ${value.pragma.name}" has no effect`, loc, `You can safely remove this line.`));
				} else {
					pragma2loc[value.pragma.name] = loc;
					pragmas[value.pragma.name] = false;
				}
			}
		},
		onPatchData(data, loc) {
			let oldData = data.old ? data.old.buffer : null;
			let newData = data.new.buffer;

			if (data.new.placeholders > 0) {
				if (!options.allowPlaceholders)
					vkp.errors.push(new VkpParseError(`Found placeholder instead of real patch data`, data.new.loc));
			}

			if (pragmas.old_equal_ff && !oldData)
				oldData = Buffer.alloc(newData.length).fill(0xFF);

			if (oldData && oldData.length < newData.length)
				vkp.errors.push(new VkpParseError(`Old data (${oldData.length} bytes) is less than new data (${newData.length} bytes)`, data.old.loc));

			if (pragmas.warn_no_old_on_apply && !oldData) {
				if (!options.allowEmptyOldData)
					vkp.warnings.push(new VkpParseError(`Old data is not specified`, data.new.loc, `Undo operation is impossible!`));
			}

			vkp.writes.push({
				addr:			(offsetCorrector ? offsetCorrector.value : 0) + data.address,
				size:			newData.length,
				old:			oldData,
				new:			newData,
				loc,
				pragmas:		{...pragmas}
			});
		},
		onOffset(value, loc) {
			offsetCorrector = { value: value.offset, text: value.text, loc };
		},
		onWarning(e) {
			vkp.warnings.push(e);
		},
		onError(e) {
			vkp.errors.push(e);
		}
	});

	let unsinishedPragmas = [];
	for (let k in pragmas) {
		if (pragmas[k] !== DEFAULT_PRAGMAS[k]) {
			let cancel = pragmas[k] ? `#pragma disable ${k}` : `#pragma enable ${k}`;
			vkp.warnings.push(new VkpParseError(`Uncanceled pragma "${k}"`, pragma2loc[k], `Please put "${cancel}" at the end of the patch.`));
		}
	}

	if (offsetCorrector && offsetCorrector.value != 0)
		vkp.warnings.push(new VkpParseError(`Uncanceled offset ${offsetCorrector.text}`, offsetCorrector.loc, `Please put "+0" at the end of the patch.`));

	vkp.valid = (vkp.errors.length == 0);

	return vkp;
}

function vkpDetectContent(text) {
	if (text.indexOf('{\\rtf1') >= 0)
		return "RTF";
	let trimmedText = text.replace(/\/\*.*?\*\//gs, '').replace(/(\/\/|;|#).*?$/mg, '');
	if (trimmedText.match(/^\s*(0x[a-f0-9]+|[a-f0-9]+)\s*:[^\\/]/mi))
		return "PATCH";
	if (text.match(/;!(к патчу прикреплён файл|There is a file attached to this patch), https?:\/\//i))
		return "DOWNLOAD_STUB";
	if (!trimmedText.trim().length)
		return "EMPTY";
	return "UNKNOWN";
}

// CP1251 -> UTF-8 + CRLF -> LF (with RTF support)
async function vkpNormalizeWithRTF(text) {
	if (!Buffer.isBuffer(text))
		throw new Error(`Patch text is not Buffer!`);

	if (text.indexOf('{\\rtf1') >= 0) {
		// Strip RTF images
		while (true) {
			let pictureIndex = text.indexOf('{\\pict');
			if (pictureIndex >= 0) {
				let pictureEndIndex = text.indexOf('}', pictureIndex);
				if (pictureIndex >= 0) {
					text = Buffer.concat([ text.slice(0, pictureIndex), text.slice(pictureEndIndex + 1) ]);
					continue;
				}
			}
			break;
		}

		text = text.toString('utf-8').replace(/{\\pict.*?\}/gsi, ''); // remove pictures
		let parsed = await new Promise((resolve, reject) => {
			RTFParser.string(text, (err, doc) => {
				if (err) {
					reject(err);
				} else {
					resolve(doc);
				}
			});
		});

		let lines = [];
		for (let p of parsed.content) {
			lines.push(p.content.map((s) => s.value).join(''));
		}
		return lines.join('\n');
	}
	return iconv.decode(text, 'windows-1251').replace(/(\r\n|\n|\r)/g, "\n");
}

// CP1251 -> UTF-8 + CRLF -> LF
function vkpNormalize(text) {
	if (!Buffer.isBuffer(text))
		throw new Error(`Patch text is not Buffer!`);
	return iconv.decode(text, 'windows-1251').replace(/(\r\n|\n|\r)/g, "\n");
}

// UTF-8 -> CP1251 + LF -> CRLF
function vkpCanonicalize(text) {
	return iconv.encode(text.replace(/(\r\n|\n|\r)/g, "\r\n"), 'windows-1251');
}

export { vkpParse, vkpRawParser, vkpNormalize, vkpNormalizeWithRTF, vkpCanonicalize, vkpDetectContent };
