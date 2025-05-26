"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const targetHash = '0x4a1b974e31e005ad301f0f7ef6ff3d756c261fe66213c0faa95f27c2befaed31';
const word = 'simple';
const hash = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(word));
console.log(`Word: "${word}"`);
console.log(`Generated hash: ${hash}`);
console.log(`Target hash:    ${targetHash}`);
console.log(`Match: ${hash === targetHash ? 'YES ✓' : 'NO ✗'}`);
//# sourceMappingURL=verify-simple.js.map