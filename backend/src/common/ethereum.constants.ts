// Charger les variables d'environnement directement dans ce fichier
import * as dotenv from 'dotenv';
dotenv.config();

// Adresse du contrat - peut être remplacée par une variable d'environnement
export const RIDDLE_CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xA6FDC30159443F08a76dcAc0469A7d6B0dE878d2';
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

// URLs RPC pour différents réseaux
export const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/751622ee07f244f29a4c75bb6c9dff15';
export const HARDHAT_RPC_URL = process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545/';

// ChainId pour différents réseaux
export const SEPOLIA_CHAIN_ID = 11155111;
export const HARDHAT_CHAIN_ID = 31337;

// Mode de l'environnement (local ou testnet)
export const NETWORK_MODE = process.env.NETWORK_MODE || 'testnet'; // 'local' ou 'testnet'

// RPC URL actif en fonction du mode
export const ACTIVE_RPC_URL = NETWORK_MODE === 'local' ? HARDHAT_RPC_URL : SEPOLIA_RPC_URL;

// ChainId actif en fonction du mode
export const ACTIVE_CHAIN_ID = NETWORK_MODE === 'local' ? HARDHAT_CHAIN_ID : SEPOLIA_CHAIN_ID;

// Nom du réseau actif
export const ACTIVE_NETWORK_NAME = NETWORK_MODE === 'local' ? 'Hardhat Local' : 'Sepolia Test Network';

// Nom de la devise
export const ACTIVE_CURRENCY_NAME = NETWORK_MODE === 'local' ? 'Hardhat ETH' : 'Sepolia ETH';

// URL de l'explorateur de blocs
export const ACTIVE_BLOCK_EXPLORER = NETWORK_MODE === 'local' ? '' : 'https://sepolia.etherscan.io/';
