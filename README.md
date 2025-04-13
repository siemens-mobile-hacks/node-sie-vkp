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
