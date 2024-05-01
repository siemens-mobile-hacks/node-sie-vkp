import iconv from 'iconv-lite';
import fs from 'fs';
import { parseVKP } from './parseVKP.js';

// str: https://github.com/siemens-mobile-hacks/v-klay/blob/91173c9db9796d3de155d6899ab41259460e0000/V_Utilites.cpp

//let text = iconv.decode(fs.readFileSync("../patches/patches/EL71v45/ElfPack-18_03_2024-v3_2_2.vkp"), 'windows1251');
let text = iconv.decode(fs.readFileSync("../patches/patches/A50v12/2698-Many_links_on_different_keys.vkp"), 'windows1251');

text = `
AA: A B
`;

parseVKP(text, true);
