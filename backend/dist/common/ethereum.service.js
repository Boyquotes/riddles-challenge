"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthereumService = void 0;
const common_1 = require("@nestjs/common");
const ethers_1 = require("ethers");
const ethereum_constants_1 = require("./ethereum.constants");
let EthereumService = class EthereumService {
    constructor() {
        try {
            const networkMode = process.env.NETWORK_MODE || 'testnet';
            console.log(`Mode réseau: ${networkMode}`);
            if (networkMode === 'local') {
                class HardhatProvider extends ethers_1.ethers.JsonRpcProvider {
                    async resolveName(name) {
                        if (name.match(/^0x[0-9a-fA-F]{40}$/)) {
                            return name;
                        }
                        return ethers_1.ethers.ZeroAddress;
                    }
                }
                this.provider = new HardhatProvider(ethereum_constants_1.ACTIVE_RPC_URL);
                console.log('Utilisation du provider Hardhat personnalisé sans ENS');
            }
            else {
                this.provider = new ethers_1.ethers.JsonRpcProvider(ethereum_constants_1.ACTIVE_RPC_URL);
                console.log('Utilisation du provider standard pour le réseau de test');
            }
            console.log(`Provider configuré pour le réseau: ${networkMode}, RPC: ${ethereum_constants_1.ACTIVE_RPC_URL}, ChainId: ${ethereum_constants_1.ACTIVE_CHAIN_ID}`);
            this.contract = new ethers_1.ethers.Contract(ethereum_constants_1.RIDDLE_CONTRACT_ADDRESS, ethereum_constants_1.RIDDLE_CONTRACT_ABI, this.provider);
            console.log(`Contrat configuré à l'adresse: ${ethereum_constants_1.RIDDLE_CONTRACT_ADDRESS}`);
        }
        catch (error) {
            console.error('Erreur lors de l\'initialisation du service Ethereum:', error);
            throw error;
        }
    }
    getContract() {
        return this.contract;
    }
    async getRiddle() {
        try {
            const riddleText = await this.contract.riddle();
            const isActive = await this.contract.isActive();
            const winner = await this.contract.winner();
            return {
                question: riddleText,
                isActive,
                winner
            };
        }
        catch (error) {
            console.error('Error fetching riddle from blockchain:', error);
            throw new Error('Failed to fetch riddle from blockchain');
        }
    }
    async checkAnswer(answer) {
        try {
            const answerHash = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(answer));
            const isActive = await this.contract.isActive();
            const winner = await this.contract.winner();
            const riddleText = await this.contract.riddle();
            console.log('Riddle text:', riddleText);
            console.log('Is active:', isActive);
            console.log('Winner:', winner);
            if (!isActive || winner !== ethers_1.ethers.ZeroAddress) {
                return false;
            }
            const callData = this.contract.interface.encodeFunctionData('submitAnswer', [answer]);
            const result = await this.provider.call({
                to: ethereum_constants_1.RIDDLE_CONTRACT_ADDRESS,
                data: callData
            });
            console.log('Answer checked successfully');
            console.log('Answer hash:', answerHash);
            console.log('Answer:', answer);
            console.log('Result:', result);
            console.log('Result hash:', ethers_1.ethers.keccak256(result));
            console.log(`Checking answer hash: ${answerHash}`);
            return false;
        }
        catch (error) {
            console.error('Error checking answer:', error);
            return false;
        }
    }
    prepareMetaMaskTransaction(answer) {
        const callData = this.contract.interface.encodeFunctionData('submitAnswer', [answer]);
        const { ACTIVE_NETWORK_NAME, ACTIVE_CURRENCY_NAME, ACTIVE_RPC_URL, ACTIVE_BLOCK_EXPLORER } = require('./ethereum.constants');
        return {
            to: ethereum_constants_1.RIDDLE_CONTRACT_ADDRESS,
            data: callData,
            chainId: ethereum_constants_1.ACTIVE_CHAIN_ID,
            networkName: ACTIVE_NETWORK_NAME,
            currencyName: ACTIVE_CURRENCY_NAME,
            rpcUrl: ACTIVE_RPC_URL,
            blockExplorer: ACTIVE_BLOCK_EXPLORER
        };
    }
    async submitAnswer(answer, walletKey) {
        try {
            let signer;
            if (walletKey) {
                signer = new ethers_1.ethers.Wallet(walletKey, this.provider);
            }
            else {
                console.warn('No wallet key provided, using read-only mode');
                return await this.checkAnswer(answer);
            }
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.submitAnswer(answer);
            const receipt = await tx.wait();
            if (receipt.status === 1) {
                const winner = await this.contract.winner();
                const isWinner = winner.toLowerCase() === signer.address.toLowerCase();
                console.log(`Answer submitted successfully. Is winner: ${isWinner}`);
                return isWinner;
            }
            return false;
        }
        catch (error) {
            console.error('Error submitting answer to contract:', error);
            return false;
        }
    }
};
exports.EthereumService = EthereumService;
exports.EthereumService = EthereumService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EthereumService);
//# sourceMappingURL=ethereum.service.js.map