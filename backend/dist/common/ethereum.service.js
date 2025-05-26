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
var EthereumService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthereumService = void 0;
const common_1 = require("@nestjs/common");
const ethers_1 = require("ethers");
const event_emitter_1 = require("@nestjs/event-emitter");
const socket_service_1 = require("./socket.service");
const ethereum_constants_1 = require("./ethereum.constants");
let EthereumService = EthereumService_1 = class EthereumService {
    constructor(eventEmitter, socketService) {
        this.eventEmitter = eventEmitter;
        this.socketService = socketService;
        this.logger = new common_1.Logger(EthereumService_1.name);
        this.eventListeners = [];
        try {
            const networkMode = process.env.NETWORK_MODE || 'testnet';
            this.logger.log(`Mode réseau: ${networkMode}`);
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
                this.logger.log('Utilisation du provider Hardhat personnalisé sans ENS');
            }
            else {
                this.provider = new ethers_1.ethers.JsonRpcProvider(ethereum_constants_1.ACTIVE_RPC_URL);
                this.logger.log('Utilisation du provider standard pour le réseau de test');
            }
            this.logger.log(`Provider configuré pour le réseau: ${networkMode}, RPC: ${ethereum_constants_1.ACTIVE_RPC_URL}, ChainId: ${ethereum_constants_1.ACTIVE_CHAIN_ID}`);
            this.contract = new ethers_1.ethers.Contract(ethereum_constants_1.RIDDLE_CONTRACT_ADDRESS, ethereum_constants_1.RIDDLE_CONTRACT_ABI, this.provider);
            this.logger.log(`Contrat configuré à l'adresse: ${ethereum_constants_1.RIDDLE_CONTRACT_ADDRESS}`);
        }
        catch (error) {
            this.logger.error('Erreur lors de l\'initialisation du service Ethereum:', error);
            throw error;
        }
    }
    async onModuleInit() {
        this.logger.log('Initialisation du service Ethereum...');
        await this.setupEventListeners();
    }
    async onModuleDestroy() {
        this.logger.log('Nettoyage des écouteurs d\'événements...');
        await this.cleanupEventListeners();
    }
    testEmitBlockchainError() {
        console.log('Test d\'envoi d\'une notification d\'erreur blockchain via Socket.IO');
        const testErrorMsg = '[TEST] Tentative de préparation d\'une transaction pour une énigme inactive';
        this.socketService.emitBlockchainError(testErrorMsg);
    }
    async setupEventListeners() {
        try {
            const networkMode = process.env.NETWORK_MODE || 'testnet';
            const winnerListener = (...args) => {
                try {
                    const winner = args[0];
                    this.logger.log(`Événement Winner détecté! Gagnant: ${winner}`);
                    this.logger.log(`Arguments complets de l'événement Winner: ${JSON.stringify(args)}`);
                    this.eventEmitter.emit('riddle.solved', {
                        winner,
                        timestamp: new Date().toISOString(),
                        riddleId: 'onchain'
                    });
                }
                catch (error) {
                    this.logger.error(`Erreur lors du traitement de l'événement Winner:`, error);
                    this.logger.error(`Arguments reçus: ${typeof args}, ${Array.isArray(args) ? 'Array' : 'Not Array'}, ${args ? 'Not null' : 'Null'}`);
                    if (args) {
                        try {
                            this.logger.error(`Arguments bruts: ${args.toString()}`);
                        }
                        catch (e) {
                            this.logger.error(`Impossible de convertir les arguments en string:`, e);
                        }
                    }
                }
            };
            this.contract.on('Winner', winnerListener);
            this.eventListeners.push({ eventName: 'Winner', listener: winnerListener });
            this.logger.log('Écouteur d\'événement Winner configuré');
            const answerAttemptListener = (...args) => {
                try {
                    const user = args[0];
                    const correct = args[1];
                    this.logger.log(`Événement AnswerAttempt détecté! Utilisateur: ${user}, Correct: ${correct}`);
                    this.logger.log(`Arguments complets de l'événement AnswerAttempt: ${JSON.stringify(args)}`);
                    this.eventEmitter.emit('riddle.attempt', {
                        user,
                        correct,
                        timestamp: new Date().toISOString(),
                        riddleId: 'onchain'
                    });
                    if (correct === true) {
                        this.logger.log('Réponse correcte détectée, envoi de notification de succès aux clients');
                        this.socketService.emitBlockchainSuccess('Riddle solved!');
                    }
                    else {
                        this.logger.log('Réponse incorrecte détectée, envoi de notification aux clients');
                        this.socketService.emitBlockchainError('Énigme non résolue. La réponse soumise est incorrecte.');
                    }
                }
                catch (error) {
                    this.logger.error(`Erreur lors du traitement de l'événement AnswerAttempt:`, error);
                    this.logger.error(`Arguments reçus: ${typeof args}, ${Array.isArray(args) ? 'Array' : 'Not Array'}, ${args ? 'Not null' : 'Null'}`);
                    if (args) {
                        try {
                            this.logger.error(`Arguments bruts: ${args.toString()}`);
                        }
                        catch (e) {
                            this.logger.error(`Impossible de convertir les arguments en string:`, e);
                        }
                    }
                }
            };
            this.contract.on('AnswerAttempt', answerAttemptListener);
            this.eventListeners.push({ eventName: 'AnswerAttempt', listener: answerAttemptListener });
            this.logger.log('Écouteur d\'événement AnswerAttempt configuré');
            this.logger.log('Écouteurs d\'événements configurés avec succès');
        }
        catch (error) {
            this.logger.error('Erreur lors de la configuration des écouteurs d\'événements:', error);
        }
    }
    async cleanupEventListeners() {
        try {
            for (const { eventName, listener } of this.eventListeners) {
                this.contract.off(eventName, listener);
            }
            this.eventListeners = [];
            this.logger.log('Écouteurs d\'événements nettoyés avec succès');
        }
        catch (error) {
            this.logger.error('Erreur lors du nettoyage des écouteurs d\'événements:', error);
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
            this.logger.error('Erreur lors de la récupération de l\'énigme depuis la blockchain:', error);
            throw new Error('Failed to fetch riddle from blockchain');
        }
    }
    async checkAnswer(answer) {
        try {
            const answerHash = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(answer));
            this.logger.log(`Hash de la réponse proposée: ${answerHash}`);
            const isActive = await this.contract.isActive();
            const winner = await this.contract.winner();
            const riddleText = await this.contract.riddle();
            this.logger.log({
                riddleText,
                isActive,
                winner,
            });
            this.logger.log('Hashs pour des réponses communes:');
            const commonAnswers = ['42', 'hello', 'world', 'ethereum', 'blockchain', 'smart contract', 'zama', 'fhe', 'privacy', 'crypto', 'answer', 'solution', 'correct', 'true', 'false', 'yes', 'no', 'maybe', 'secret', 'password'];
            for (const commonAnswer of commonAnswers) {
                const hash = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(commonAnswer));
                this.logger.log(`${commonAnswer}: ${hash}`);
            }
            try {
                const wallet = ethers_1.ethers.Wallet.createRandom().connect(this.provider);
                const contractWithSigner = this.contract.connect(wallet);
                await this.contract.getFunction('submitAnswer').estimateGas(answer, { from: wallet.address });
                this.logger.log('La simulation de transaction a réussi, la réponse pourrait être correcte');
                return true;
            }
            catch (simulationError) {
                this.logger.log('La simulation de transaction a échoué, la réponse est probablement incorrecte:', simulationError);
                return false;
            }
        }
        catch (error) {
            this.logger.error('Erreur lors de la vérification de la réponse:', error);
            return false;
        }
    }
    async prepareMetaMaskTransaction(answer) {
        try {
            const isActive = await this.contract.isActive();
            if (!isActive) {
                const errorMsg = '[EthereumService] Tentative de préparation d\'une transaction pour une énigme inactive';
                this.logger.error(errorMsg);
                console.error(errorMsg);
                this.socketService.emitBlockchainError(errorMsg);
                throw new Error(errorMsg);
            }
            const callData = this.contract.interface.encodeFunctionData('submitAnswer', [answer]);
            console.log('callData', callData);
            this.logger.log('callData', callData);
            return {
                to: ethereum_constants_1.RIDDLE_CONTRACT_ADDRESS,
                data: callData,
                chainId: ethereum_constants_1.ACTIVE_CHAIN_ID,
                networkName: ethereum_constants_1.ACTIVE_NETWORK_NAME,
                currencyName: ethereum_constants_1.ACTIVE_CURRENCY_NAME,
                rpcUrl: ethereum_constants_1.ACTIVE_RPC_URL,
                blockExplorer: ethereum_constants_1.ACTIVE_BLOCK_EXPLORER
            };
        }
        catch (error) {
            const errorMsg = `[EthereumService] Erreur lors de la préparation de la transaction MetaMask: ${error.message}`;
            this.logger.error(errorMsg);
            console.error(errorMsg);
            this.socketService.emitBlockchainError(errorMsg);
            throw new Error(errorMsg);
        }
    }
    async submitAnswer(answer, walletKey) {
        try {
            let signer;
            console.log('walletKey', walletKey);
            console.log('this.provider', this.provider);
            console.log('this.contract', this.contract);
            console.log('answer', answer);
            if (walletKey) {
                signer = new ethers_1.ethers.Wallet(walletKey, this.provider);
            }
            else {
                this.logger.warn('Aucune clé de portefeuille fournie, utilisation du mode lecture seule');
                return await this.checkAnswer(answer);
            }
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.submitAnswer(answer);
            const receipt = await tx.wait();
            if (receipt && receipt.status === 1) {
                const winner = await this.contract.winner();
                const isWinner = winner.toLowerCase() === signer.address.toLowerCase();
                this.logger.log(`Réponse soumise avec succès. Est gagnant: ${isWinner}`);
                return isWinner;
            }
            return false;
        }
        catch (error) {
            this.logger.error('Erreur lors de la soumission de la réponse au contrat:', error);
            return false;
        }
    }
    async setRiddle(riddle, answerHash, walletKey) {
        try {
            let signer;
            if (walletKey) {
                signer = new ethers_1.ethers.Wallet(walletKey, this.provider);
            }
            else {
                this.logger.warn('Aucune clé de portefeuille fournie, utilisation d\'un portefeuille aléatoire (mode local uniquement)');
                signer = ethers_1.ethers.Wallet.createRandom().connect(this.provider);
            }
            const contractWithSigner = this.contract.connect(signer);
            let formattedAnswerHash = answerHash;
            if (!answerHash.startsWith('0x')) {
                formattedAnswerHash = '0x' + answerHash;
            }
            if (formattedAnswerHash.length !== 66) {
                throw new Error('Le hash de la réponse doit être au format bytes32 (32 octets)');
            }
            const tx = await contractWithSigner.setRiddle(riddle, formattedAnswerHash);
            const receipt = await tx.wait();
            if (receipt && receipt.status === 1) {
                this.logger.log(`Énigme définie avec succès: "${riddle}" avec le hash de réponse: ${formattedAnswerHash}`);
                return true;
            }
            return false;
        }
        catch (error) {
            this.logger.error('Erreur lors de la définition de l\'énigme dans le contrat:', error);
            return false;
        }
    }
};
exports.EthereumService = EthereumService;
exports.EthereumService = EthereumService = EthereumService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [event_emitter_1.EventEmitter2,
        socket_service_1.SocketService])
], EthereumService);
//# sourceMappingURL=ethereum.service.js.map