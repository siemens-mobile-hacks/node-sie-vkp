[![NPM Version](https://img.shields.io/npm/v/%40sie-js%2Fvkp)](https://www.npmjs.com/package/@sie-js/vkp)

# SUMMARY

Parser and utils for the `.VKP` files format which is used in the V-Klay.

# INSTALL
```bash
npm i @sie-js/vkp
```

# USAGE

```js
import fs from 'fs';
import { vkpNormalize, vkpParse } from '@sie-js/vkp';

// Convert from windows-1251 to UTF-8 + replace CRLF to LF
const patchText = vkpNormalize(fs.readFileSync('../patches/patches/E71v45/10732-ElfPack-18_03_2024-v3_2_2.vkp'));

// Parse patch
const vkp = vkpParse(patchText);
console.dir(vkp, { depth: null });

if (vkp.warnings.length || vkp.errors.length) {
    for (const warn of vkp.warnings) {
        console.log(`Warning: ${warn.message}`);
        console.log("```");
        console.log(warn.codeFrame(patchText));
        console.log("```");
        console.log("");
    }

    for (const err of vkp.errors) {
        console.log(`Error: ${err.message}`);
        console.log("```");
        console.log(err.codeFrame(patchText));
        console.log("```");
        console.log("");
    }

    console.log("");
}
```

# AI-assisted contributions

We are not against AI. We are against vibe coding, AI slop, and attempts to offload engineering work to a model. This project prioritizes quality, not development speed or results at any cost.

1. **Do not use AI-generated text in human-to-human communication.**

   Write comments, discussions, PR descriptions, and responses to reviewers yourself.

2. **Do not let AI submit PRs or commits.**

   The author must always be a human who has personally reviewed the changes and takes responsibility for them.

4. **Do not submit code primarily designed or written by AI.**

   Architecture, algorithms, code organization, and the final implementation must be decided by a human. AI may only be used as an auxiliary tool.

6. **You must understand all the code you submit.**

   You must be able to explain every change, justify your decisions, and fix any problems yourself. If you do not understand the code, open a feature request instead of a PR.

8. **Code must be simple, clear, and tested.**

   Follow KISS, the project's coding style, and its existing architecture. Do not introduce unnecessary abstractions, dependencies, or untested changes.

AI slop PRs will be closed without review.
