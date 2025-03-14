import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import { Blob } from "buffer";
import { globSync } from 'glob';
import { vkpParse, vkpDetectContent } from '../src/index.js';
import child_process from 'child_process';
import { sprintf } from 'sprintf-js';

let vkp = vkpParse(fs.readFileSync(`/tmp/s352004.crk`).toString(), {
	allowEmptyOldData:	true,
	allowPlaceholders:	true,
});

let chunks = vkpMergeChunks(vkp);
for (let c of chunks) {
	console.log(sprintf("%08X: %s %s", c.addr, c.old.toString('hex'), c.new.toString('hex')));
}

function vkpMergeChunks(vkp) {
	let chunks = [];
	let chunkIsSame = (w) => {
		let prevChunk = chunks[chunks.length - 1];
		if ((prevChunk.addr + prevChunk.size) - w.addr != 0)
			return false;

		for (let k in prevChunk.pragmas) {
			if (prevChunk.pragmas[k] !== w.pragmas[k])
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
			   old: w.old ? Buffer.from(w.old) : null,
						new: Buffer.from(w.new),
			});
		} else {
			let prevChunk = chunks[chunks.length - 1];
			prevChunk.size += w.size;
			if (prevChunk.old)
				prevChunk.old = Buffer.concat([prevChunk.old, w.old]);
			prevChunk.new = Buffer.concat([prevChunk.new, w.new]);
		}
	}
	return chunks;
}
