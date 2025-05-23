export declare class EthereumService {
    private provider;
    private contract;
    constructor();
    getRiddle(): Promise<{
        question: string;
        isActive: boolean;
        winner: string;
    }>;
}
