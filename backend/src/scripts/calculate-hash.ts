import { ethers } from 'ethers';

// Récupérer le mot depuis les arguments de la ligne de commande
const word = process.argv[2] || 'simple';

// Calcul du hash keccak256
const hash = ethers.keccak256(ethers.toUtf8Bytes(word));

console.log(`Mot: "${word}"`);
console.log(`Hash keccak256: ${hash}`);

// Afficher un message d'aide si aucun argument n'est fourni
if (!process.argv[2]) {
  console.log('\nUtilisation: npx ts-node src/scripts/calculate-hash.ts <mot>');
  console.log('Exemple:    npx ts-node src/scripts/calculate-hash.ts zama');
}
