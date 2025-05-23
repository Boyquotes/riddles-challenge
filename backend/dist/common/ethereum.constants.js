"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEPOLIA_RPC_URL = exports.RIDDLE_CONTRACT_ABI = exports.RIDDLE_CONTRACT_ADDRESS = void 0;
exports.RIDDLE_CONTRACT_ADDRESS = '0xA6FDC30159443F08a76dcAc0469A7d6B0dE878d2';
exports.RIDDLE_CONTRACT_ABI = [
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
exports.SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/751622ee07f244f29a4c75bb6c9dff15';
//# sourceMappingURL=ethereum.constants.js.map