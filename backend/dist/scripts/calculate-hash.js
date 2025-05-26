"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const word = process.argv[2] || 'simple';
const hash = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(word));
console.log(`Mot: "${word}"`);
console.log(`Hash keccak256: ${hash}`);
if (!process.argv[2]) {
    console.log('\nUtilisation: npx ts-node src/scripts/calculate-hash.ts <mot>');
    console.log('Exemple:    npx ts-node src/scripts/calculate-hash.ts zama');
}
//# sourceMappingURL=calculate-hash.js.map