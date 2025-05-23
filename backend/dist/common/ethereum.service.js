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
        this.provider = new ethers_1.ethers.JsonRpcProvider(ethereum_constants_1.SEPOLIA_RPC_URL);
        this.contract = new ethers_1.ethers.Contract(ethereum_constants_1.RIDDLE_CONTRACT_ADDRESS, ethereum_constants_1.RIDDLE_CONTRACT_ABI, this.provider);
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
};
exports.EthereumService = EthereumService;
exports.EthereumService = EthereumService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EthereumService);
//# sourceMappingURL=ethereum.service.js.map