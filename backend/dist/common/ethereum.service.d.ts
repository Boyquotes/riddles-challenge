import { ethers } from 'ethers';
interface OnchainRiddleContract extends ethers.BaseContract {
    riddle(): Promise<string>;
    isActive(): Promise<boolean>;
    winner(): Promise<string>;
    submitAnswer(answer: string): Promise<ethers.ContractTransactionResponse>;
}
export declare class EthereumService {
    private provider;
    private contract;
    constructor();
    getContract(): OnchainRiddleContract;
    getRiddle(): Promise<{
        question: string;
        isActive: boolean;
        winner: string;
    }>;
    checkAnswer(answer: string): Promise<boolean>;
    prepareMetaMaskTransaction(answer: string): {
        to: string;
        data: string;
        chainId: number;
        networkName: any;
        currencyName: any;
        rpcUrl: any;
        blockExplorer: any;
    };
    submitAnswer(answer: string, walletKey?: string): Promise<boolean>;
}
export {};
