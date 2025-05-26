"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const targetHash = '0x4a1b974e31e005ad301f0f7ef6ff3d756c261fe66213c0faa95f27c2befaed31';
function computeHash(input) {
    return ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(input));
}
function checkMatch(input) {
    const hash = computeHash(input);
    const matches = hash === targetHash;
    console.log(`"${input}" => ${hash}${matches ? ' ✓ MATCH!' : ''}`);
    return matches;
}
const commonWords = [
    'hello', 'world', 'blockchain', 'ethereum', 'solidity', 'smart contract',
    'crypto', 'zama', 'riddle', 'puzzle', 'answer', 'solution',
    'secret', 'password', 'key', 'hash', 'keccak',
    '42', 'yes', 'no', 'true', 'false',
    'bitcoin', 'web3', 'defi', 'nft',
    'the answer', 'correct', 'right',
    'time', 'shadow', 'nothing', 'silence', 'echo', 'age', 'future', 'past',
    'mirror', 'reflection', 'dream', 'memory', 'thought', 'wind', 'air',
    'water', 'fire', 'earth', 'name', 'word', 'letter', 'number',
    'darkness', 'light', 'sun', 'moon', 'star', 'sky',
    'egg', 'candle', 'book', 'map', 'clock', 'calendar',
    'footsteps', 'breath', 'heartbeat', 'voice',
    'Time', 'Shadow', 'Nothing', 'Silence', 'Echo',
    'temps', 'ombre', 'rien', 'silence', 'écho', 'âge', 'futur', 'passé',
    'miroir', 'réflexion', 'rêve', 'mémoire', 'pensée', 'vent', 'air',
    'eau', 'feu', 'terre', 'nom', 'mot', 'lettre', 'nombre',
    'obscurité', 'lumière', 'soleil', 'lune', 'étoile', 'ciel',
    'oeuf', 'bougie', 'livre', 'carte', 'horloge', 'calendrier',
    'pas', 'souffle', 'battement', 'voix',
];
console.log(`Attempting to find a match for hash: ${targetHash}`);
console.log('---------------------------------------------------');
let found = false;
for (const word of commonWords) {
    if (checkMatch(word)) {
        found = true;
        break;
    }
}
if (!found) {
    console.log('---------------------------------------------------');
    console.log('No match found among common words.');
    console.log('You may need to try more specific words related to the riddle context.');
}
//# sourceMappingURL=decode-keccak.js.map