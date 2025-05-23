import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { 
  RIDDLE_CONTRACT_ABI, 
  RIDDLE_CONTRACT_ADDRESS, 
  ACTIVE_RPC_URL,
  ACTIVE_CHAIN_ID,
  NETWORK_MODE
} from './ethereum.constants';

// Define the contract interface to help TypeScript recognize the methods
interface OnchainRiddleContract extends ethers.BaseContract {
  riddle(): Promise<string>;
  isActive(): Promise<boolean>;
  winner(): Promise<string>;
  submitAnswer(answer: string): Promise<ethers.ContractTransactionResponse>;
}

@Injectable()
export class EthereumService {
  private provider: ethers.JsonRpcProvider;
  private contract: OnchainRiddleContract;

  constructor() {
    try {
      // Configurer le provider pour le réseau approprié
      const networkMode = process.env.NETWORK_MODE || 'testnet';
      console.log(`Mode réseau: ${networkMode}`);
      
      // Créer un provider différent selon le mode réseau
      if (networkMode === 'local') {
        // Pour Hardhat local, utiliser un JsonRpcProvider simple
        // Créer une classe personnalisée qui étend JsonRpcProvider pour éviter les problèmes ENS
        class HardhatProvider extends ethers.JsonRpcProvider {
          // Surcharger la méthode resolveName pour éviter les appels ENS
          async resolveName(name: string): Promise<string> {
            // Si le nom ressemble à une adresse Ethereum, le retourner directement
            if (name.match(/^0x[0-9a-fA-F]{40}$/)) {
              return name;
            }
            // Sinon, retourner l'adresse nulle
            return ethers.ZeroAddress;
          }
        }
        
        // Utiliser notre provider personnalisé
        this.provider = new HardhatProvider(ACTIVE_RPC_URL);
        console.log('Utilisation du provider Hardhat personnalisé sans ENS');
      } else {
        // Pour les réseaux de test comme Sepolia, utiliser le provider standard
        this.provider = new ethers.JsonRpcProvider(ACTIVE_RPC_URL);
        console.log('Utilisation du provider standard pour le réseau de test');
      }
      
      console.log(`Provider configuré pour le réseau: ${networkMode}, RPC: ${ACTIVE_RPC_URL}, ChainId: ${ACTIVE_CHAIN_ID}`);
      
      // Créer le contrat avec le provider
      this.contract = new ethers.Contract(
        RIDDLE_CONTRACT_ADDRESS,
        RIDDLE_CONTRACT_ABI,
        this.provider
      ) as unknown as OnchainRiddleContract;
      
      console.log(`Contrat configuré à l'adresse: ${RIDDLE_CONTRACT_ADDRESS}`);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du service Ethereum:', error);
      throw error;
    }
  }
  
  /**
   * Get the contract instance
   */
  getContract(): OnchainRiddleContract {
    return this.contract;
  }

  async getRiddle(): Promise<{ question: string; isActive: boolean; winner: string }> {
    try {
      const riddleText = await this.contract.riddle();
      const isActive = await this.contract.isActive();
      const winner = await this.contract.winner();
      
      return {
        question: riddleText,
        isActive,
        winner
      };
    } catch (error) {
      console.error('Error fetching riddle from blockchain:', error);
      throw new Error('Failed to fetch riddle from blockchain');
    }
  }
  
  /**
   * Check if an answer is correct by comparing its hash with the one stored in the contract
   * This is a read-only operation that doesn't modify the blockchain state
   */
  async checkAnswer(answer: string): Promise<boolean> {
    try {
      // Calculate the hash of the answer
      const answerHash = ethers.keccak256(ethers.toUtf8Bytes(answer));
      
      // Get the current state of the contract
      const isActive = await this.contract.isActive();
      const winner = await this.contract.winner();
      const riddleText = await this.contract.riddle();
      console.log('Riddle text:', riddleText);
      console.log('Is active:', isActive);
      console.log('Winner:', winner);
      
      // If the riddle is not active or already has a winner, return false
      if (!isActive || winner !== ethers.ZeroAddress) {
        return false;
      }
      
      // We can't directly check if the answer is correct without submitting it
      // For a read-only check, we can simulate a call to the contract
      // This doesn't modify the blockchain state
      const callData = this.contract.interface.encodeFunctionData('submitAnswer', [answer]);
      
      // Simulate the transaction
      const result = await this.provider.call({
        to: RIDDLE_CONTRACT_ADDRESS,
        data: callData
      });
      console.log('Answer checked successfully');
      console.log('Answer hash:', answerHash);
      console.log('Answer:', answer);
      console.log('Result:', result);
      console.log('Result hash:', ethers.keccak256(result));
      // If the call didn't revert, we can assume the answer is potentially correct
      // But we need to verify by checking the hash
      
      // For a real verification, we would need to know the answer hash stored in the contract
      // Since we don't have direct access to it, we'll use a simplified approach for now
      // In a real implementation, you might want to listen for events from the contract
      
      console.log(`Checking answer hash: ${answerHash}`);
      return false; // This is simplified - in a real implementation, you'd verify against the contract's stored hash
    } catch (error) {
      console.error('Error checking answer:', error);
      return false;
    }
  }
  
  /**
   * Prepare transaction data for MetaMask to submit an answer to the contract
   * This returns the data needed for the frontend to create a transaction with MetaMask
   */
  prepareMetaMaskTransaction(answer: string) {
    // Encode the function call data for submitAnswer
    const callData = this.contract.interface.encodeFunctionData('submitAnswer', [answer]);
    
    // Import additional constants
    const { 
      ACTIVE_NETWORK_NAME, 
      ACTIVE_CURRENCY_NAME, 
      ACTIVE_RPC_URL, 
      ACTIVE_BLOCK_EXPLORER 
    } = require('./ethereum.constants');
    
    // Return the transaction parameters needed for MetaMask
    return {
      to: RIDDLE_CONTRACT_ADDRESS,
      data: callData,
      chainId: ACTIVE_CHAIN_ID, // Utilise le chainId actif en fonction du mode
      networkName: ACTIVE_NETWORK_NAME,
      currencyName: ACTIVE_CURRENCY_NAME,
      rpcUrl: ACTIVE_RPC_URL,
      blockExplorer: ACTIVE_BLOCK_EXPLORER
    };
  }
  
  /**
   * Submit an answer to the contract
   * This will modify the blockchain state if the answer is correct
   */
  async submitAnswer(answer: string, walletKey?: string): Promise<boolean> {
    try {
      // If a wallet key is provided, use it to create a signer
      // Otherwise, this will be a read-only call
      let signer;
      if (walletKey) {
        signer = new ethers.Wallet(walletKey, this.provider);
      } else {
        // For testing purposes only - in production, you'd need a real wallet
        console.warn('No wallet key provided, using read-only mode');
        return await this.checkAnswer(answer);
      }
      
      // Create a contract instance with the signer
      const contractWithSigner = this.contract.connect(signer) as unknown as OnchainRiddleContract;
      
      // Submit the answer to the contract
      const tx = await contractWithSigner.submitAnswer(answer);
      
      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      
      // Check if the transaction was successful
      if (receipt.status === 1) {
        // Check if we became the winner
        const winner = await this.contract.winner();
        const isWinner = winner.toLowerCase() === signer.address.toLowerCase();
        
        console.log(`Answer submitted successfully. Is winner: ${isWinner}`);
        return isWinner;
      }
      
      return false;
    } catch (error) {
      console.error('Error submitting answer to contract:', error);
      return false;
    }
  }
}
