"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const InputDataDecoder = require('ethereum-input-data-decoder');
const ethereum_constants_1 = require("../common/ethereum.constants");
const decoder = new InputDataDecoder(ethereum_constants_1.RIDDLE_CONTRACT_ABI);
const inputData = process.argv[2] || '0x1fdf55850000000000000000000000000000000000000000000000000000000000000040e8d6f33c864d8c15cf8e3284db164ba343453a48937e23d2f191bd2297a9543f000000000000000000000000000000000000000000000000000000000000004f5768617420686173206b65797320627574206e6f206c6f636b732c20737061636520627574206e6f20726f6f6d2c20616e6420796f752063616e20656e74657220627574206e6f7420676f20696e3f0000000000000000000000000000000000';
if (!process.argv[2]) {
    console.log('Aucun argument fourni, utilisation de la valeur par défaut');
    console.log('Usage: npx ts-node src/scripts/decode-input.ts <input-data-hex>');
}
const result = decoder.decodeData(inputData);
console.log('Decoded Transaction Data:');
console.log('------------------------');
console.log('Method:', result.method);
console.log('Types:', result.types);
console.log('Names:', result.names);
console.log('Inputs:');
if (result.inputs) {
    result.inputs.forEach((input, index) => {
        var _a, _b;
        const name = ((_a = result.names) === null || _a === void 0 ? void 0 : _a[index]) || `param${index}`;
        const type = ((_b = result.types) === null || _b === void 0 ? void 0 : _b[index]) || 'unknown';
        let value = input;
        if (type === 'string' && typeof input === 'string' && input.startsWith('0x')) {
            const hex = input.replace(/0+$/, '');
            try {
                value = Buffer.from(hex.slice(2), 'hex').toString('utf8').replace(/\0+$/, '');
            }
            catch (e) {
                console.error('Error converting hex to string:', e);
            }
        }
        console.log(`  ${name} (${type}):`, value);
    });
}
//# sourceMappingURL=decode-input.js.map