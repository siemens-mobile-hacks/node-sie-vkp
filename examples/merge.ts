import fs from "fs";
import { vkpParse, VkpParseResult, VkpPragmaName, VkpWrite } from "../src/index.js";
import { sprintf } from "sprintf-js";

const vkp = vkpParse(fs.readFileSync(`/tmp/s352004.crk`).toString(), {
	allowEmptyOldData:	true,
	allowPlaceholders:	true,
});

const chunks = vkpMergeChunks(vkp);
for (let c of chunks) {
	console.log(sprintf("%08X: %s %s", c.addr, c.old?.toString('hex') || '', c.new.toString('hex')));
}

function vkpMergeChunks(vkp: VkpParseResult): VkpWrite[] {
	const chunks: VkpWrite[] = [];
	const chunkIsSame = (w: VkpWrite): boolean => {
		const prevChunk = chunks[chunks.length - 1];
		if ((prevChunk.addr + prevChunk.size) - w.addr != 0)
			return false;
		for (let k in prevChunk.pragmas) {
			if (prevChunk.pragmas[k as VkpPragmaName] !== w.pragmas[k as VkpPragmaName])
				return false;
		}
		if (prevChunk.old && !w.old)
			return false;
		if (!prevChunk.old && w.old)
			return false;
		return true;
	};

	for (let w of vkp.writes) {
		if (!chunks.length || !chunkIsSame(w)) {
			chunks.push({
				addr: w.addr,
				size: w.size,
				pragmas: {...w.pragmas},
				old: w.old ? Buffer.from(w.old) : undefined,
				new: Buffer.from(w.new),
				loc: { line: w.loc.line, column: w.loc.column }
			});
		} else {
			const prevChunk = chunks[chunks.length - 1];
			prevChunk.size += w.size;
			if (prevChunk.old && w.old)
				prevChunk.old = Buffer.concat([prevChunk.old, w.old]);
			prevChunk.new = Buffer.concat([prevChunk.new, w.new]);
		}
	}
	return chunks;
}
