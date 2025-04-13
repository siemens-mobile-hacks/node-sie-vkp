import iconv from "iconv-lite";
import { vkpRawParser } from "./parser.js";
import { VkpLocation, VkpParseError } from "./VkpParseError.js";

export type VkpContentType = "RTF" | "PATCH" | "DOWNLOAD_STUB" | "EMPTY" | "UNKNOWN";

export interface VkpPragmas {
	warn_no_old_on_apply: boolean;
	warn_if_new_exist_on_apply: boolean;
	warn_if_old_exist_on_undo: boolean;
	undo: boolean;
	old_equal_ff: boolean;
	[key: string]: boolean;
}

export interface VkpWrite {
	addr: number;
	size: number;
	old: Buffer | null;
	new: Buffer;
	loc: VkpLocation;
	pragmas: VkpPragmas;
}

export interface VkpParseResult {
	ast: any;
	valid: boolean;
	writes: VkpWrite[];
	warnings: VkpParseError[];
	errors: VkpParseError[];
}

export interface VkpParseOptions {
	allowEmptyOldData?: boolean;
	allowPlaceholders?: boolean;
}

export interface VkpOffsetCorrector {
	value: number;
	text: string;
	loc: VkpLocation;
}

const DEFAULT_PRAGMAS: VkpPragmas = {
	warn_no_old_on_apply:		true,
	warn_if_new_exist_on_apply:	true,
	warn_if_old_exist_on_undo:	true,
	undo:						true,
	old_equal_ff:				false,
};

export function vkpParse(text: string, options?: VkpParseOptions): VkpParseResult {
	const validOptions = {
		allowEmptyOldData: false,
		allowPlaceholders: false,
		...options
	};

	const vkp: VkpParseResult = {
		ast: null,
		valid: false,
		writes: [],
		warnings: [],
		errors: [],
	};

	const pragmas: VkpPragmas = { ...DEFAULT_PRAGMAS };
	const pragmaToLocation: Record<string, VkpLocation> = {};
	let offsetCorrector: VkpOffsetCorrector | undefined;

	vkpRawParser(text, {
		onPragma(value, loc) {
			const pragmaName = value.pragma.name as keyof VkpPragmas;
			if (value.pragma.action == "enable") {
				if (pragmas[pragmaName]) {
					vkp.warnings.push(new VkpParseError(
						`Useless "#pragma ${value.pragma.action} ${pragmaName}" has no effect`,
						loc,
						`You can safely remove this line.`
					));
				} else {
					pragmas[pragmaName] = true;
					pragmaToLocation[pragmaName] = loc;
				}
			} else if (value.pragma.action == "disable") {
				if (!pragmas[pragmaName]) {
					vkp.warnings.push(new VkpParseError(
						`Useless "#pragma ${value.pragma.action} ${pragmaName}" has no effect`,
						loc,
						`You can safely remove this line.`
					));
				} else {
					pragmaToLocation[pragmaName] = loc;
					pragmas[pragmaName] = false;
				}
			}
		},
		onPatchData(data, loc) {
			let oldData = data.old ? data.old.buffer : null;
			const newData = data.new.buffer;

			if (data.new.placeholders > 0) {
				if (!validOptions.allowPlaceholders)
					vkp.errors.push(new VkpParseError(`Found placeholder instead of real patch data`, data.new.loc));
			}

			if (pragmas.old_equal_ff && !oldData)
				oldData = Buffer.alloc(newData.length).fill(0xFF);

			if (oldData && oldData.length < newData.length) {
				vkp.errors.push(new VkpParseError(
					`Old data (${oldData.length} bytes) is less than new data (${newData.length} bytes)`,
					data.old!.loc
				));
			}

			if (pragmas.warn_no_old_on_apply && !oldData) {
				if (!validOptions.allowEmptyOldData) {
					vkp.warnings.push(new VkpParseError(
						`Old data is not specified`,
						data.new.loc,
						`Undo operation is impossible!`
					));
				}
			}

			vkp.writes.push({
				addr: (offsetCorrector ? offsetCorrector.value : 0) + data.address,
				size: newData.length,
				old: oldData,
				new: newData,
				loc,
				pragmas: { ...pragmas }
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

	for (const k in pragmas) {
		if (pragmas[k] !== DEFAULT_PRAGMAS[k]) {
			const cancel = pragmas[k] ? `#pragma disable ${k}` : `#pragma enable ${k}`;
			vkp.warnings.push(new VkpParseError(
				`Uncanceled pragma "${k}"`,
				pragmaToLocation[k],
				`Please put "${cancel}" at the end of the patch.`
			));
		}
	}

	if (offsetCorrector && offsetCorrector.value != 0) {
		vkp.warnings.push(new VkpParseError(
			`Uncanceled offset ${offsetCorrector.text}`,
			offsetCorrector.loc,
			`Please put "+0" at the end of the patch.`
		));
	}

	vkp.valid = (vkp.errors.length == 0);

	return vkp;
}

export function vkpDetectContent(text: string): VkpContentType {
	if (text.indexOf('{\\rtf1') >= 0)
		return "RTF";
	const trimmedText = text.replace(/\/\*.*?\*\//gs, '').replace(/(\/\/|;|#).*?$/mg, '');
	if (trimmedText.match(/^\s*(0x[a-f0-9]+|[a-f0-9]+)\s*:[^\\/]/mi))
		return "PATCH";
	if (text.match(/;!(к патчу прикреплён файл|There is a file attached to this patch), https?:\/\//i))
		return "DOWNLOAD_STUB";
	if (!trimmedText.trim().length)
		return "EMPTY";
	return "UNKNOWN";
}

// CP1251 -> UTF-8 + CRLF -> LF (with RTF support)
export async function vkpNormalizeWithRTF(text: Buffer): Promise<string> {
	if (!Buffer.isBuffer(text))
		throw new Error(`Patch text is not Buffer!`);

	const { default: RTFParser } = await import('rtf-parser');

	if (text.indexOf('{\\rtf1') >= 0) {
		// Strip RTF images
		while (true) {
			const pictureIndex = text.indexOf('{\\pict');
			if (pictureIndex >= 0) {
				const pictureEndIndex = text.indexOf('}', pictureIndex);
				if (pictureIndex >= 0) {
					text = Buffer.concat([ text.subarray(0, pictureIndex), text.subarray(pictureEndIndex + 1) ]);
					continue;
				}
			}
			break;
		}

		const textStr = text.toString('utf-8').replace(/{\\pict.*?}/gsi, ''); // remove pictures

		interface RTFDocument {
			content: {
				content: {
					value: string;
				}[];
			}[];
		}

		const parsed = await new Promise<RTFDocument>((resolve, reject) => {
			RTFParser.string(textStr, (err: Error | null, doc: RTFDocument) => {
				if (err) {
					reject(err);
				} else {
					resolve(doc);
				}
			});
		});

		const lines: string[] = [];
		for (const p of parsed.content) {
			lines.push(p.content.map((s) => s.value).join(''));
		}
		return lines.join('\n');
	}
	return iconv.decode(text, 'windows-1251').replace(/(\r\n|\n|\r)/g, "\n");
}

// CP1251 -> UTF-8 + CRLF -> LF
export function vkpNormalize(text: Buffer): string {
	if (!Buffer.isBuffer(text))
		throw new Error(`Patch text is not Buffer!`);
	return iconv.decode(text, 'windows-1251').replace(/(\r\n|\n|\r)/g, "\n");
}

// UTF-8 -> CP1251 + LF -> CRLF
export function vkpCanonicalize(text: string): Buffer {
	return iconv.encode(text.replace(/(\r\n|\n|\r)/g, "\r\n"), 'windows-1251');
}

export { vkpRawParser, VkpParseError };
