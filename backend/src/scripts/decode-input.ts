const InputDataDecoder = require('ethereum-input-data-decoder');
import { readFileSync } from 'fs';
import { join } from 'path';

// Import the ABI from your constants
import { RIDDLE_CONTRACT_ABI } from '../common/ethereum.constants';

// Create a decoder instance with the ABI
const decoder = new InputDataDecoder(RIDDLE_CONTRACT_ABI);

// Get the input data from command line arguments
const inputData = process.argv[2] || '0x1fdf55850000000000000000000000000000000000000000000000000000000000000040e8d6f33c864d8c15cf8e3284db164ba343453a48937e23d2f191bd2297a9543f000000000000000000000000000000000000000000000000000000000000004f5768617420686173206b65797320627574206e6f206c6f636b732c20737061636520627574206e6f20726f6f6d2c20616e6420796f752063616e20656e74657220627574206e6f7420676f20696e3f0000000000000000000000000000000000';

// Check if input data is provided
if (!process.argv[2]) {
  console.log('Aucun argument fourni, utilisation de la valeur par défaut');
  console.log('Usage: npx ts-node src/scripts/decode-input.ts <input-data-hex>');
}

// Decode the input data
const result = decoder.decodeData(inputData);

console.log('Decoded Transaction Data:');
console.log('------------------------');
console.log('Method:', result.method);
console.log('Types:', result.types);
console.log('Names:', result.names);
console.log('Inputs:');

// Format and display the inputs in a more readable way
if (result.inputs) {
  result.inputs.forEach((input, index) => {
    const name = result.names?.[index] || `param${index}`;
    const type = result.types?.[index] || 'unknown';
    
    // For string inputs, convert hex to string if needed
    let value = input;
    if (type === 'string' && typeof input === 'string' && input.startsWith('0x')) {
      // Remove trailing zeros that might be padding
      const hex = input.replace(/0+$/, '');
      // Convert hex to string
      try {
        value = Buffer.from(hex.slice(2), 'hex').toString('utf8').replace(/\0+$/, '');
      } catch (e) {
        console.error('Error converting hex to string:', e);
      }
    }
    
    console.log(`  ${name} (${type}):`, value);
  });
}

// Alternative: If you have a contract ABI file instead of importing from constants
// Example usage with ABI file:
/*
const abiPath = join(__dirname, '../../artifacts/contracts/Riddle.sol/Riddle.json');
const contractJson = JSON.parse(readFileSync(abiPath, 'utf8'));
const decoderFromFile = new InputDataDecoder(contractJson.abi);
const resultFromFile = decoderFromFile.decodeData(inputData);
console.log('\nDecoded from file:', resultFromFile);
*/
