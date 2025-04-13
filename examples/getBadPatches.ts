import iconv from "iconv-lite";
import fs from "fs";
import path from "path";
import { globSync } from "glob";
import { vkpDetectContent, vkpNormalizeWithRTF, vkpParse } from "../src/index.js";
import child_process from "child_process";

const PATCHES_DIR = new URL('../../patches/patches', import.meta.url).pathname;

interface ArchiveContents {
	lsarContents: {
		XADFileName: string;
		XADIndex: string | number;
	}[];
}

for (let file of readFiles(PATCHES_DIR)) {
	if (!file.match(/\.vkp$/))
		continue;

	let patchText = await vkpNormalizeWithRTF(fs.readFileSync(`${PATCHES_DIR}/${file}`));
	const patchUrlMatch = patchText.match(/Details: (https?:\/\/.*?)$/m);
	const patchUrl = patchUrlMatch ? patchUrlMatch[1] : 'unknown';

	const detectedType = vkpDetectContent(patchText);
	if (detectedType == "DOWNLOAD_STUB") {
		const patchId = path.basename(file).split('-')[0];

		const additionalFiles = globSync(`${PATCHES_DIR}/*/${patchId}-*.{rar,zip}`);
		if (!additionalFiles.length) {
			console.error(`${file} - is download stub, but additional file not found!`);
			continue;
		}

		const additionalFile = additionalFiles[0];
		const archive = await getFilesFromArchive(additionalFile);

		for (let entry of archive.lsarContents) {
			if (entry.XADFileName.match(/\.vkp$/i)) {
				patchText = await vkpNormalizeWithRTF(await extractFileFromArchive(additionalFile, entry.XADIndex));
				analyzePatch(patchUrl, additionalFile, entry.XADFileName, patchText);
			}
		}
	} else {
		analyzePatch(patchUrl, file, undefined, patchText);
	}
}

function analyzePatch(patchUrl: string, file: string, subfile: string | undefined, patchText: string): void {
	const location = subfile ? `${file} -> ${subfile}` : file;

	const vkp = vkpParse(patchText, {
		allowEmptyOldData: true,
		allowPlaceholders: true,
	});

	if (vkp.warnings.length || vkp.errors.length) {
		console.log(`[${location}](${patchUrl})`);

		for (let warn of vkp.warnings) {
			console.log(`Warning: ${warn.message}`);
			console.log("```");
			console.log(warn.codeFrame(patchText));
			console.log("```");
			console.log("");
		}

		for (let err of vkp.errors) {
			console.log(`Error: ${err.message}`);
			console.log("```");
			console.log(err.codeFrame(patchText));
			console.log("```");
			console.log("");
		}

		console.log("");
	}
}

function readFiles(dir: string, base?: string, files?: string[]): string[] {
	base = base || "";
	files = files || [];
	fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
		if (entry.isDirectory()) {
			readFiles(dir + "/" + entry.name, base + entry.name + "/", files);
		} else {
			files.push(base + entry.name);
		}
	});
	return files;
}

async function getFilesFromArchive(file: string): Promise<ArchiveContents> {
	return new Promise((resolve, reject) => {
		const proc = child_process.spawn("lsar", ["-j", file]);
		let json = "";
		proc.stdout.on('data', (chunk) => json += chunk);
		proc.on('error', (e) => reject(e));
		proc.on('close', (status) => {
			try {
				if (status != 0)
					throw new Error(`Invalid archive [status=${status}]: ${file}`);
				resolve(JSON.parse(json));
			} catch (e) {
				reject(e);
			}
		});
	});
}

function extractFileFromArchive(file: string, index: string | number): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const proc = child_process.spawn("unar", ["-i", "-o", "-", file, index.toString()]);
		let buffer: Buffer[] = [];
		proc.stdout.on('data', (chunk: Buffer) => buffer.push(chunk));
		proc.on('error', (e) => reject(e));
		proc.on('close', (status) => {
			try {
				if (status != 0)
					throw new Error(`Invalid archive [status=${status}]: ${file}`);
				resolve(Buffer.concat(buffer));
			} catch (e) {
				reject(e);
			}
		});
	});
}
