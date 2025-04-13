import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import { Blob } from "buffer";
import { globSync } from 'glob';
import { vkpParse, vkpDetectContent } from '../src/index.js';
import child_process from 'child_process';

const PATCHES_DIR = `${import.meta.dirname}/../../patches/patches`;

for (let file of readFiles(PATCHES_DIR)) {
	if (!file.match(/\.vkp$/))
		continue;

	let patchText = iconv.decode(fs.readFileSync(`${PATCHES_DIR}/${file}`), 'windows1251').replace(/(\r\n|\n)/g, '\n');
	const patchUrl = patchText.match(/Details: (https?:\/\/.*?)$/m)[1];

	const detectedType = vkpDetectContent(patchText);
	if (detectedType == "DOWNLOAD_STUB") {
		const patchId = path.basename(file).split('-')[0];

		const [additionalFile] = globSync(`${PATCHES_DIR}/*/${patchId}-*.{rar,zip}`);
		if (!additionalFile) {
			console.error(`${file} - is download stub, but additional file not found!`);
			continue;
		}

		const archive = await getFilesFromArchive(additionalFile);

		const extractedPatches = [];
		for (let entry of archive.lsarContents) {
			if (entry.XADFileName.match(/\.vkp$/i)) {
				patchText = (await extractFileFromArchive(additionalFile, entry.XADIndex)).toString('utf-8');
				analyzePatch(patchUrl, additionalFile, entry.XADFileName, patchText);
			}
		}
	} else {
		analyzePatch(patchUrl, file, null, patchText);
	}
}

function analyzePatch(patchUrl, file, subfile, patchText) {
	const location = subfile ? `${file} -> ${subfile}` : file;

	const vkp = vkpParse(patchText, {
		allowEmptyOldData:	true,
		allowPlaceholders:	true,
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

function readFiles(dir, base, files) {
	base = base || "";
	files = files || [];
	fs.readdirSync(dir, {withFileTypes: true}).forEach((entry) => {
		if (entry.isDirectory()) {
			readFiles(dir + "/" + entry.name, base + entry.name + "/", files);
		} else {
			files.push(base + entry.name);
		}
	});
	return files;
}

async function getFilesFromArchive(file) {
	return new Promise((resolve, reject) => {
		let proc = child_process.spawn("lsar", ["-j", file], { encoding: 'utf-8' });
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
			proc = json = null;
		});
	});
}

function extractFileFromArchive(file, index) {
	return new Promise((resolve, reject) => {
		let proc = child_process.spawn("unar", ["-i", "-o", "-", file, index]);
		let buffer = [];
		proc.stdout.on('data', (chunk) => buffer.push(chunk));
		proc.on('error', (e) => reject(e));
		proc.on('close', (status) => {
			try {
				if (status != 0)
					throw new Error(`Invalid archive [status=${status}]: ${file}`);
				resolve(Buffer.concat(buffer));
			} catch (e) {
				reject(e);
			}
			proc = buffer = null;
		});
	});
}
