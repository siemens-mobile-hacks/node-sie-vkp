import { test, expect } from "vitest";
import { vkpParse } from "./index.js";

test('warn: useless pragma', () => {
	const vkp = vkpParse(`#pragma enable warn_no_old_on_apply`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(1);
	expect(vkp.warnings[0]).toHaveProperty("message", "Useless \"#pragma enable warn_no_old_on_apply\" has no effect at line 1 col 1\nYou can safely remove this line.");
});

test('warn: uncanceled pragma', () => {
	const vkp = vkpParse(`#pragma disable warn_no_old_on_apply`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(1);
	expect(vkp.warnings[0]).toHaveProperty("message", "Uncanceled pragma \"warn_no_old_on_apply\" at line 1 col 1\nPlease put \"#pragma enable warn_no_old_on_apply\" at the end of the patch.");
});

test('warn: uncanceled offset', () => {
	const vkp = vkpParse(`+123`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(1);
	expect(vkp.warnings[0]).toHaveProperty("message", "Uncanceled offset +123 at line 1 col 1\nPlease put \"+0\" at the end of the patch.");
});

test('warn: bad comments', () => {
	const vkp = vkpParse(`
		*/
		/* comment...
	`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(2);
	expect(vkp.warnings[0]).toHaveProperty("message", "Trailing multiline comment end at line 2 col 3");
	expect(vkp.warnings[1]).toHaveProperty("message", "Unfinished multiline comment at line 3 col 3");
});

test('warn: no old data', () => {
	const vkp = vkpParse(`
		AA: BB
	`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(1);
	expect(vkp.warnings[0]).toHaveProperty("message", "Old data is not specified at line 2 col 7\nUndo operation is impossible!");
});

test('error: space after number', () => { // thanks Viktor89
	const vkp = vkpParse(`
		AAAA: BB 0i123; comment
		AAAA: BB 0x12; comment
		AAAA: BB CC; comment
	`);
	expect(vkp.valid).toBe(false);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(2);
	expect(vkp.errors[0]).toHaveProperty("message", "No whitespace between number and comment at line 2 col 17");
	expect(vkp.errors[1]).toHaveProperty("message", "No whitespace between number and comment at line 3 col 16");
});

test('error: placeholder', () => {
	const vkp = vkpParse(`AAAA: BB XX`);
	expect(vkp.valid).toBe(false);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(1);
	expect(vkp.errors[0]).toHaveProperty("message", "Found placeholder instead of real patch data at line 1 col 10");
});

test('error: invalid hex data', () => {
	const vkp = vkpParse(`AAAA: BB B`);
	expect(vkp.valid).toBe(false);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(1);
	expect(vkp.errors[0]).toHaveProperty("message", "Hex data (B) must be even length at line 1 col 10");
});

test('error: old data is less than new data', () => {
	const vkp = vkpParse(`AAAA: BB BBCC`);
	expect(vkp.valid).toBe(false);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(1);
	expect(vkp.errors[0]).toHaveProperty("message", "Old data (1 bytes) is less than new data (2 bytes) at line 1 col 7");
});

test('error: comment tokens in string', () => {
	const vkp = vkpParse(`
		AAAA: AABBCCDDEE "//"
		AAAA: AABBCCDDEE "/*"
		AAAA: AABBCCDDEE "\\/\\/"
		AAAA: AABBCCDDEE "\\/\\*"
	`);
	expect(vkp.valid).toBe(false);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(2);
	expect(vkp.errors[0]).toHaveProperty("message", "Unescaped // is not allowed in string: \"//\" at line 2 col 20\nEscape these ambiguous characters like this: \\/* or \\/\\/.");
	expect(vkp.errors[1]).toHaveProperty("message", "Unescaped /* is not allowed in string: \"/*\" at line 3 col 20\nEscape these ambiguous characters like this: \\/* or \\/\\/.");
});

test('error: number ranges', () => {
	const vkp = vkpParse(`
		AAAA: AABBCCDDEE 0i0,0i999
		AAAA: AABBCCDDEE 0i0,0i99999
		AAAA: AABBCCDDEE 0i0,0i99999999
		AAAA: AABBCCDDEE 0i0,0i9999999999
		AAAA: AABBCCDDEE 0i0,0i9999999999999
		AAAA: AABBCCDDEE 0i0,0i999999999999999
		AAAA: AABBCCDDEE 0i0,0i99999999999999999
		AAAA: AABBCCDDEE 0i0,0i99999999999999999999

		AAAA: AABBCCDDEE 0i0,0i-999
		AAAA: AABBCCDDEE 0i0,0i-99999
		AAAA: AABBCCDDEE 0i0,0i-99999999
		AAAA: AABBCCDDEE 0i0,0i-9999999999
		AAAA: AABBCCDDEE 0i0,0i-9999999999999
		AAAA: AABBCCDDEE 0i0,0i-999999999999999
		AAAA: AABBCCDDEE 0i0,0i-99999999999999999
		AAAA: AABBCCDDEE 0i0,0i-99999999999999999999
	`);
	expect(vkp.valid).toBe(false);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(16);
	expect(vkp.errors[0]).toHaveProperty("message", "Number 0i999 exceeds allowed range 0 ... 255 at line 2 col 24");
	expect(vkp.errors[1]).toHaveProperty("message", "Number 0i99999 exceeds allowed range 0 ... 65535 at line 3 col 24");
	expect(vkp.errors[2]).toHaveProperty("message", "Number 0i99999999 exceeds allowed range 0 ... 16777215 at line 4 col 24");
	expect(vkp.errors[3]).toHaveProperty("message", "Number 0i9999999999 exceeds allowed range 0 ... 4294967295 at line 5 col 24");
	expect(vkp.errors[4]).toHaveProperty("message", "Number 0i9999999999999 exceeds allowed range 0 ... 1099511627775 at line 6 col 24");
	expect(vkp.errors[5]).toHaveProperty("message", "Number 0i999999999999999 exceeds allowed range 0 ... 281474976710655 at line 7 col 24");
	expect(vkp.errors[6]).toHaveProperty("message", "Number 0i99999999999999999 exceeds allowed range 0 ... 72057594037927935 at line 8 col 24");
	expect(vkp.errors[7]).toHaveProperty("message", "Number 0i99999999999999999999 exceeds allowed range 0 ... 18446744073709551615 at line 9 col 24");
	expect(vkp.errors[8]).toHaveProperty("message", "Number 0i-999 exceeds allowed range -127 ... +127 at line 11 col 24");
	expect(vkp.errors[9]).toHaveProperty("message", "Number 0i-99999 exceeds allowed range -32767 ... +32767 at line 12 col 24");
	expect(vkp.errors[10]).toHaveProperty("message", "Number 0i-99999999 exceeds allowed range -8388607 ... +8388607 at line 13 col 24");
	expect(vkp.errors[11]).toHaveProperty("message", "Number 0i-9999999999 exceeds allowed range -2147483647 ... +2147483647 at line 14 col 24");
	expect(vkp.errors[12]).toHaveProperty("message", "Number 0i-9999999999999 exceeds allowed range -549755813887 ... +549755813887 at line 15 col 24");
	expect(vkp.errors[13]).toHaveProperty("message", "Number 0i-999999999999999 exceeds allowed range -140737488355327 ... +140737488355327 at line 16 col 24");
	expect(vkp.errors[14]).toHaveProperty("message", "Number 0i-99999999999999999 exceeds allowed range -36028797018963967 ... +36028797018963967 at line 17 col 24");
	expect(vkp.errors[15]).toHaveProperty("message", "Number 0i-99999999999999999999 exceeds allowed range -9223372036854775807 ... +9223372036854775807 at line 18 col 24");
});

test('error: bad numbers', () => {
	const vkp = vkpParse(`
		AAAA: AABBCCDDEE 0i0,0n1234
		AAAA: AABBCCDDEE 0i0,0n111111111111111111111111111111111
	`);
	expect(vkp.valid).toBe(false);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(2);
	expect(vkp.errors[0]).toHaveProperty("message", "Syntax error at line 2 col 24");
	expect(vkp.errors[1]).toHaveProperty("message", "Number 0n111111111111111111111111111111111 exceeds allowed range 0n0 ... 0n11111111111111111111111111111111 at line 3 col 24");
});

test('error: bad decimal numbers', () => {
	const vkp = vkpParse(`
		00000000: FF,FF,FF 0i+000,0i+00,0i+0
		00000000: FFFF 0i+0000
		00000000: FFFFFF 0i+0000000
		00000000: FFFFFFFF 0i+000000000
		00000000: FFFFFFFFFF 0i+000000000000
		00000000: FFFFFFFFFFFF 0i+00000000000000
		00000000: FFFFFFFFFFFFFF 0i+0000000000000000
		00000000: FFFFFFFFFFFFFFFF 0i+0000000000000000000
	`);
	expect(vkp.valid).toBe(false);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(7);
	const hint = "Must be: 3 (for BYTE), 5 (for WORD), 8 (for 3 BYTES), 10 (for DWORD), 13 (for 5 BYTES), 15 (for 6 BYTES),  17 (for 7 BYTES), " +
		"20 (for 8 BYTES).Use leading zeroes to match the number of digits.";
	expect(vkp.errors[0]).toHaveProperty("message", "The wrong number of digits in integer (0i+0000) at line 3 col 18\n" + hint);
	expect(vkp.errors[1]).toHaveProperty("message", "The wrong number of digits in integer (0i+0000000) at line 4 col 20\n" + hint);
	expect(vkp.errors[2]).toHaveProperty("message", "The wrong number of digits in integer (0i+000000000) at line 5 col 22\n" + hint);
	expect(vkp.errors[3]).toHaveProperty("message", "The wrong number of digits in integer (0i+000000000000) at line 6 col 24\n" + hint);
	expect(vkp.errors[4]).toHaveProperty("message", "The wrong number of digits in integer (0i+00000000000000) at line 7 col 26\n" + hint);
	expect(vkp.errors[5]).toHaveProperty("message", "The wrong number of digits in integer (0i+0000000000000000) at line 8 col 28\n" + hint);
	expect(vkp.errors[6]).toHaveProperty("message", "The wrong number of digits in integer (0i+0000000000000000000) at line 9 col 30\n" + hint);
});

test('error: bad address & offset', () => {
	const vkp = vkpParse(`
		+AAAAAAAAA
		AAAAAAAAA: AA BB
	`);
	expect(vkp.valid).toBe(false);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(2);
	expect(vkp.errors[0]).toHaveProperty("message", "Offset +AAAAAAAAA exceeds allowed range 00000000 ... FFFFFFFF at line 2 col 3");
	expect(vkp.errors[1]).toHaveProperty("message", "Address AAAAAAAAA: exceeds allowed range 00000000 ... FFFFFFFF at line 3 col 3");
});

test('error: bad string', () => {
	const vkp = vkpParse(`
		AAAAAAAA: FFFFFFFFFFFFFFFF "\\xAA"
		AAAAAAAA: FFFFFFFFFFFFFFFF "\\u1234"
		AAAAAAAA: FFFFFFFFFFFFFFFF "\\777"
		AAAAAAAA: FFFFFFFFFFFFFFFF "\\jam"
	`);
	expect(vkp.valid).toBe(false);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(4);
	expect(vkp.errors[0]).toHaveProperty("message", "Bad escape sequence (\\xAA) at line 2 col 31\nAllowed range: \\x00-\\x7F.");
	expect(vkp.errors[1]).toHaveProperty("message", "Unknown escape sequence (\\u1234) at line 3 col 31");
	expect(vkp.errors[2]).toHaveProperty("message", "Unknown escape sequence (\\777) at line 4 col 31");
	expect(vkp.errors[3]).toHaveProperty("message", "Unknown escape sequence (\\j) at line 5 col 31");
});

test('data: valid address & offset', () => {
	const vkp = vkpParse(`
		-123450
		A8123456: AA BB
		+0
	`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(0);
	expect(vkp.writes.length).toBe(1);
	expect(vkp.writes[0].addr).toBe(0xA8000006);
});

test('data: HEX bytes', () => {
	const vkp = vkpParse(`00000000: FFFFFFFFFFFFFFFF DEAD926E,DE,AD,92,6E`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(0);
	expect(vkp.writes.length).toBe(1);
	expect(vkp.writes[0].new.toString('hex')).toBe('dead926edead926e');
});

test('data: HEX numbers', () => {
	const vkp = vkpParse(`00000000: FFFFFFFFFFFFFFFFFFFFFFFF 0xDEAD926E,0xDEAD,0x92,0x6E,0x1,0x2,0x123`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(0);
	expect(vkp.writes.length).toBe(1);
	expect(vkp.writes[0].new.toString('hex')).toBe('6e92addeadde926e01022301');
});

test('data: binary numbers', () => {
	const vkp = vkpParse(`00000000: FFFFFFFFFFFFFFFFFFFFFF 0n11011110101011011011111011101111,0n11011110,0n1101111010101101,0n100100011010001010110`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(0);
	expect(vkp.writes.length).toBe(1);
	expect(vkp.writes[0].new.toString('hex')).toBe('efbeaddedeadde563412');
});

test('data: unsigned decimal numbers', () => {
	const vkp = vkpParse(`
		00000000: FF 0i18
		00000000: FFFF 0i04660
		00000000: FFFFFF 0i01193046
		00000000: FFFFFFFF 0i0305419896
		00000000: FFFFFFFFFF 0i0078187493530
		00000000: FFFFFFFFFFFF 0i020015998343868
		00000000: FFFFFFFFFFFFFF 0i05124095576030430
		00000000: FFFFFFFFFFFFFFFF 0i01311768467463790320
	`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(0);
	expect(vkp.writes.length).toBe(8);
	expect(vkp.writes[0].new.toString('hex')).toBe('12');
	expect(vkp.writes[1].new.toString('hex')).toBe('3412');
	expect(vkp.writes[2].new.toString('hex')).toBe('563412');
	expect(vkp.writes[3].new.toString('hex')).toBe('78563412');
	expect(vkp.writes[4].new.toString('hex')).toBe('9a78563412');
	expect(vkp.writes[5].new.toString('hex')).toBe('bc9a78563412');
	expect(vkp.writes[6].new.toString('hex')).toBe('debc9a78563412');
	expect(vkp.writes[7].new.toString('hex')).toBe('f0debc9a78563412');
});

test('data: positive decimal numbers', () => {
	const vkp = vkpParse(`
		; middle value
		00000000: FF 0i+18
		00000000: FFFF 0i+04660
		00000000: FFFFFF 0i+01193046
		00000000: FFFFFFFF 0i+0305419896
		00000000: FFFFFFFFFF 0i+0078187493530
		00000000: FFFFFFFFFFFF 0i+020015998343868
		00000000: FFFFFFFFFFFFFF 0i+05124095576030430
		00000000: FFFFFFFFFFFFFFFF 0i+01311768467463790320

		; max value
		00000000: FF 0i+127
		00000000: FFFF 0i+32767
		00000000: FFFFFF 0i+08388607
		00000000: FFFFFFFF 0i+2147483647
		00000000: FFFFFFFFFF 0i+0549755813887
		00000000: FFFFFFFFFFFF 0i+140737488355327
		00000000: FFFFFFFFFFFFFF 0i+36028797018963967
		00000000: FFFFFFFFFFFFFFFF 0i+09223372036854775807

		; min value
		00000000: FF 0i+000
		00000000: FFFF 0i+00000
		00000000: FFFFFF 0i+00000000
		00000000: FFFFFFFF 0i+0000000000
		00000000: FFFFFFFFFF 0i+0000000000000
		00000000: FFFFFFFFFFFF 0i+000000000000000
		00000000: FFFFFFFFFFFFFF 0i+00000000000000000
		00000000: FFFFFFFFFFFFFFFF 0i+00000000000000000000
	`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(0);
	expect(vkp.writes.length).toBe(24);
	expect(vkp.writes[0].new.toString('hex')).toBe('12');
	expect(vkp.writes[1].new.toString('hex')).toBe('3412');
	expect(vkp.writes[2].new.toString('hex')).toBe('563412');
	expect(vkp.writes[3].new.toString('hex')).toBe('78563412');
	expect(vkp.writes[4].new.toString('hex')).toBe('9a78563412');
	expect(vkp.writes[5].new.toString('hex')).toBe('bc9a78563412');
	expect(vkp.writes[6].new.toString('hex')).toBe('debc9a78563412');
	expect(vkp.writes[7].new.toString('hex')).toBe('f0debc9a78563412');
	expect(vkp.writes[8].new.toString('hex')).toBe('7f');
	expect(vkp.writes[9].new.toString('hex')).toBe('ff7f');
	expect(vkp.writes[10].new.toString('hex')).toBe('ffff7f');
	expect(vkp.writes[11].new.toString('hex')).toBe('ffffff7f');
	expect(vkp.writes[12].new.toString('hex')).toBe('ffffffff7f');
	expect(vkp.writes[13].new.toString('hex')).toBe('ffffffffff7f');
	expect(vkp.writes[14].new.toString('hex')).toBe('ffffffffffff7f');
	expect(vkp.writes[15].new.toString('hex')).toBe('ffffffffffffff7f');
	expect(vkp.writes[16].new.toString('hex')).toBe('00');
	expect(vkp.writes[17].new.toString('hex')).toBe('0000');
	expect(vkp.writes[18].new.toString('hex')).toBe('000000');
	expect(vkp.writes[19].new.toString('hex')).toBe('00000000');
	expect(vkp.writes[20].new.toString('hex')).toBe('0000000000');
	expect(vkp.writes[21].new.toString('hex')).toBe('000000000000');
	expect(vkp.writes[22].new.toString('hex')).toBe('00000000000000');
	expect(vkp.writes[23].new.toString('hex')).toBe('0000000000000000');
});

test('data: negative decimal numbers', () => {
	const vkp = vkpParse(`
		; middle value
		00000000: FF 0i-18
		00000000: FFFF 0i-04660
		00000000: FFFFFF 0i-01193046
		00000000: FFFFFFFF 0i-0305419896
		00000000: FFFFFFFFFF 0i-0078187493530
		00000000: FFFFFFFFFFFF 0i-020015998343868
		00000000: FFFFFFFFFFFFFF 0i-05124095576030430
		00000000: FFFFFFFFFFFFFFFF 0i-01311768467463790320

		; min value
		00000000: FF 0i-127
		00000000: FFFF 0i-32767
		00000000: FFFFFF 0i-08388607
		00000000: FFFFFFFF 0i-2147483647
		00000000: FFFFFFFFFF 0i-0549755813887
		00000000: FFFFFFFFFFFF 0i-140737488355327
		00000000: FFFFFFFFFFFFFF 0i-36028797018963967
		00000000: FFFFFFFFFFFFFFFF 0i-09223372036854775807

		; max value
		00000000: FF 0i-001
		00000000: FFFF 0i-00001
		00000000: FFFFFF 0i-00000001
		00000000: FFFFFFFF 0i-0000000001
		00000000: FFFFFFFFFF 0i-0000000000001
		00000000: FFFFFFFFFFFF 0i-000000000000001
		00000000: FFFFFFFFFFFFFF 0i-00000000000000001
		00000000: FFFFFFFFFFFFFFFF 0i-00000000000000000001
	`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(0);
	expect(vkp.writes.length).toBe(24);
	expect(vkp.writes[0].new.toString('hex')).toBe('ee');
	expect(vkp.writes[1].new.toString('hex')).toBe('cced');
	expect(vkp.writes[2].new.toString('hex')).toBe('aacbed');
	expect(vkp.writes[3].new.toString('hex')).toBe('88a9cbed');
	expect(vkp.writes[4].new.toString('hex')).toBe('6687a9cbed');
	expect(vkp.writes[5].new.toString('hex')).toBe('446587a9cbed');
	expect(vkp.writes[6].new.toString('hex')).toBe('22436587a9cbed');
	expect(vkp.writes[7].new.toString('hex')).toBe('1021436587a9cbed');
	expect(vkp.writes[8].new.toString('hex')).toBe('81');
	expect(vkp.writes[9].new.toString('hex')).toBe('0180');
	expect(vkp.writes[10].new.toString('hex')).toBe('010080');
	expect(vkp.writes[11].new.toString('hex')).toBe('01000080');
	expect(vkp.writes[12].new.toString('hex')).toBe('0100000080');
	expect(vkp.writes[13].new.toString('hex')).toBe('010000000080');
	expect(vkp.writes[14].new.toString('hex')).toBe('01000000000080');
	expect(vkp.writes[15].new.toString('hex')).toBe('0100000000000080');
	expect(vkp.writes[16].new.toString('hex')).toBe('ff');
	expect(vkp.writes[17].new.toString('hex')).toBe('ffff');
	expect(vkp.writes[18].new.toString('hex')).toBe('ffffff');
	expect(vkp.writes[19].new.toString('hex')).toBe('ffffffff');
	expect(vkp.writes[20].new.toString('hex')).toBe('ffffffffff');
	expect(vkp.writes[21].new.toString('hex')).toBe('ffffffffffff');
	expect(vkp.writes[22].new.toString('hex')).toBe('ffffffffffffff');
	expect(vkp.writes[23].new.toString('hex')).toBe('ffffffffffffffff');
});

test('data: string', () => {
	const vkp = vkpParse(`
00000000: FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF "ололо\\
\\0\\177\\100test\\x50\\x20\\a\\b\\t\\r\\n\\v\\f\\e\\\\\\/"
00000000: FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF 'ололо\\
\\0\\177\\100\\uABCDtest\\xAB\\xCD\\a\\b\\t\\r\\n\\v\\f\\e\\\\\\/'
	`);
	expect(vkp.valid).toBe(true);
	expect(vkp.warnings.length).toBe(0);
	expect(vkp.errors.length).toBe(0);
	expect(vkp.writes.length).toBe(2);
	expect(vkp.writes[0].new.toString('hex')).toBe('eeebeeebee007f407465737450200708090d0a0b0c1b5c2f');
	expect(vkp.writes[1].new.toString('hex')).toBe('3e043b043e043b043e0400007f004000cdab7400650073007400ab00cd000700080009000d000a000b000c001b005c002f00');
});
