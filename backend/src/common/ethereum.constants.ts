// Charger les variables d'environnement directement dans ce fichier
import * as dotenv from 'dotenv';
dotenv.config();

// Mode de l'environnement (local ou testnet)
export const NETWORK_MODE = process.env.NETWORK_MODE || 'testnet'; // 'local' ou 'testnet'

// Adresse du contrat - peut être remplacée par une variable d'environnement
export const RIDDLE_CONTRACT_ADDRESS = NETWORK_MODE === 'local' ? process.env.CONTRACT_ADDRESS : process.env.CONTRACT_ADDRESS_SEPOLIA;
console.log("RIDDLE_CONTRACT_ADDRESS", RIDDLE_CONTRACT_ADDRESS);
export const RIDDLE_CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "correct",
        "type": "bool"
      }
    ],
    "name": "AnswerAttempt",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "riddle",
        "type": "string"
      }
    ],
    "name": "RiddleSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "Winner",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "bot",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "isActive",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "riddle",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_riddle",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "_answerHash",
        "type": "bytes32"
      }
    ],
    "name": "setRiddle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_answer",
        "type": "string"
      }
    ],
    "name": "submitAnswer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "winner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];


// RPC URL actif en fonction du mode
export const ACTIVE_RPC_URL = NETWORK_MODE === 'local' ? process.env.HARDHAT_RPC_URL : process.env.SEPOLIA_RPC_URL;
// ChainId actif en fonction du mode
export const ACTIVE_CHAIN_ID = NETWORK_MODE === 'local' ? Number(process.env.HARDHAT_CHAIN_ID) : Number(process.env.ACTIVE_CHAIN_ID);
// Nom du réseau actif
export const ACTIVE_NETWORK_NAME = NETWORK_MODE === 'local' ? 'Hardhat Local' : 'Sepolia Test Network';
// Nom de la devise
export const ACTIVE_CURRENCY_NAME = NETWORK_MODE === 'local' ? 'Hardhat ETH' : 'Sepolia ETH';
// URL de l'explorateur de blocs
export const ACTIVE_BLOCK_EXPLORER = NETWORK_MODE === 'local' ? '' : 'https://sepolia.etherscan.io/';
