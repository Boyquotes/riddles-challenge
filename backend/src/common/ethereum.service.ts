import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SocketService } from './socket.service';
import { 
  RIDDLE_CONTRACT_ABI, 
  RIDDLE_CONTRACT_ADDRESS, 
  ACTIVE_RPC_URL,
  ACTIVE_CHAIN_ID,
  ACTIVE_NETWORK_NAME,
  ACTIVE_CURRENCY_NAME,
  ACTIVE_BLOCK_EXPLORER
} from './ethereum.constants';

/**
 * Type pour le contrat OnchainRiddle
 * Version simplifiée compatible avec ethers.js v6
 */
type OnchainRiddleContract = ethers.Contract;

/**
 * Service pour interagir avec les contrats Ethereum
 * Gère la connexion au contrat OnchainRiddle et l'écoute des événements
 */
@Injectable()
export class EthereumService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EthereumService.name);
  private provider: ethers.JsonRpcProvider;
  private contract: OnchainRiddleContract;
  private eventListeners: { eventName: string; listener: (...args: any[]) => void }[] = [];
  
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly socketService: SocketService
  ) {
    // Test d'émission d'erreur blockchain après 10 secondes
    setTimeout(() => {
      this.testEmitBlockchainError();
    }, 10000);
    try {
      // Configurer le provider pour le réseau approprié
      const networkMode = process.env.NETWORK_MODE || 'testnet';
      this.logger.log(`Mode réseau: ${networkMode}`);
      
      // Créer un provider différent selon le mode réseau
      if (networkMode === 'local') {
        // Pour Hardhat local, utiliser un JsonRpcProvider personnalisé
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
        this.logger.log('Utilisation du provider Hardhat personnalisé sans ENS');
      } else {
        // Pour les réseaux de test comme Sepolia, utiliser le provider standard
        this.provider = new ethers.JsonRpcProvider(ACTIVE_RPC_URL);
        this.logger.log('Utilisation du provider standard pour le réseau de test');
      }
      
      this.logger.log(`Provider configuré pour le réseau: ${networkMode}, RPC: ${ACTIVE_RPC_URL}, ChainId: ${ACTIVE_CHAIN_ID}`);
      
      // Créer le contrat avec le provider
      this.contract = new ethers.Contract(
        RIDDLE_CONTRACT_ADDRESS,
        RIDDLE_CONTRACT_ABI,
        this.provider
      ) as unknown as OnchainRiddleContract;
      
      this.logger.log(`Contrat configuré à l'adresse: ${RIDDLE_CONTRACT_ADDRESS}`);
    } catch (error) {
      this.logger.error('Erreur lors de l\'initialisation du service Ethereum:', error);
      throw error;
    }
  }

  /**
   * Initialiser l'écoute des événements après le démarrage du module
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initialisation du service Ethereum...');
    await this.setupEventListeners();
  }
  
  /**
   * Nettoyer les écouteurs d'événements lors de l'arrêt du module
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Nettoyage des écouteurs d\'événements...');
    await this.cleanupEventListeners();
  }
  
  /**
   * Méthode de test pour émettre une erreur blockchain via Socket.IO
   * Cette méthode est utilisée uniquement pour le débogage
   */
  testEmitBlockchainError(): void {
    console.log('Test d\'envoi d\'une notification d\'erreur blockchain via Socket.IO');
    const testErrorMsg = '[TEST] Tentative de préparation d\'une transaction pour une énigme inactive';
    this.socketService.emitBlockchainError(testErrorMsg);
  }
  
  /**
   * Configure l'écoute des événements du contrat intelligent
   */
  async setupEventListeners(): Promise<void> {
    try {
      // Vérifier si nous sommes en mode local
      const networkMode = process.env.NETWORK_MODE || 'testnet';
      
      // Écouter l'événement Winner
      const winnerListener = (...args: any[]) => {
        try {
          const winner = args[0];
          this.logger.log(`Événement Winner détecté! Gagnant: ${winner}`);
          this.logger.log(`Arguments complets de l'événement Winner: ${JSON.stringify(args)}`);
          
          // Émettre un événement pour le système
          this.eventEmitter.emit('riddle.solved', { 
            winner,
            timestamp: new Date().toISOString(),
            riddleId: 'onchain'
          });
        } catch (error) {
          this.logger.error(`Erreur lors du traitement de l'événement Winner:`, error);
          this.logger.error(`Arguments reçus: ${typeof args}, ${Array.isArray(args) ? 'Array' : 'Not Array'}, ${args ? 'Not null' : 'Null'}`);
          if (args) {
            try {
              this.logger.error(`Arguments bruts: ${args.toString()}`);
            } catch (e) {
              this.logger.error(`Impossible de convertir les arguments en string:`, e);
            }
          }
        }
      };
      
      // Ajouter l'écouteur d'événements
      this.contract.on('Winner', winnerListener);
      this.eventListeners.push({ eventName: 'Winner', listener: winnerListener });
      this.logger.log('Écouteur d\'événement Winner configuré');
      
      // Écouter l'événement AnswerAttempt
      const answerAttemptListener = (...args: any[]) => {
        try {
          const user = args[0];
          const correct = args[1];
          this.logger.log(`Événement AnswerAttempt détecté! Utilisateur: ${user}, Correct: ${correct}`);
          this.logger.log(`Arguments complets de l'événement AnswerAttempt: ${JSON.stringify(args)}`);
          
          // Émettre un événement pour le système
          this.eventEmitter.emit('riddle.attempt', { 
            user,
            correct,
            timestamp: new Date().toISOString(),
            riddleId: 'onchain'
          });
        } catch (error) {
          this.logger.error(`Erreur lors du traitement de l'événement AnswerAttempt:`, error);
          this.logger.error(`Arguments reçus: ${typeof args}, ${Array.isArray(args) ? 'Array' : 'Not Array'}, ${args ? 'Not null' : 'Null'}`);
          if (args) {
            try {
              this.logger.error(`Arguments bruts: ${args.toString()}`);
            } catch (e) {
              this.logger.error(`Impossible de convertir les arguments en string:`, e);
            }
          }
        }
      };
      
      // Ajouter l'écouteur d'événements
      this.contract.on('AnswerAttempt', answerAttemptListener);
      this.eventListeners.push({ eventName: 'AnswerAttempt', listener: answerAttemptListener });
      this.logger.log('Écouteur d\'événement AnswerAttempt configuré');
      
      this.logger.log('Écouteurs d\'événements configurés avec succès');
    } catch (error) {
      this.logger.error('Erreur lors de la configuration des écouteurs d\'événements:', error);
    }
  }
  
  /**
   * Nettoie les écouteurs d'événements lors de l'arrêt du service
   */
  async cleanupEventListeners() {
    try {
      // Supprimer tous les écouteurs d'événements
      for (const { eventName, listener } of this.eventListeners) {
        this.contract.off(eventName, listener);
      }
      this.eventListeners = [];
      this.logger.log('Écouteurs d\'événements nettoyés avec succès');
    } catch (error) {
      this.logger.error('Erreur lors du nettoyage des écouteurs d\'événements:', error);
    }
  }

  /**
   * Récupère l'instance du contrat
   */
  getContract(): OnchainRiddleContract {
    return this.contract;
  }

  /**
   * Récupère l'énigme depuis le contrat
   */
  async getRiddle(): Promise<{ question: string; isActive: boolean; winner: string }> {
    try {
      // Dans ethers.js v6, nous devons appeler les méthodes du contrat comme ceci
      const riddleText = await this.contract.riddle() as string;
      const isActive = await this.contract.isActive() as boolean;
      const winner = await this.contract.winner() as string;
      
      return {
        question: riddleText,
        isActive,
        winner
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de l\'énigme depuis la blockchain:', error);
      throw new Error('Failed to fetch riddle from blockchain');
    }
  }
  
  /**
   * Vérifie si une réponse est correcte en comparant son hash avec celui stocké dans le contrat
   * C'est une opération en lecture seule qui ne modifie pas l'état de la blockchain
   */
  async checkAnswer(answer: string): Promise<boolean> {
    try {
      // Calculer le hash de la réponse (keccak256)
      const answerHash = ethers.keccak256(ethers.toUtf8Bytes(answer));
      this.logger.log(`Hash de la réponse proposée: ${answerHash}`);
      
      // Vérifier si l'énigme est active
      const isActive = await this.contract.isActive() as boolean;
      const winner = await this.contract.winner() as string;
      const riddleText = await this.contract.riddle() as string;
      
      this.logger.log({
        riddleText,
        isActive,
        winner,
      });
      
      // Dans une implémentation réelle, vous pourriez écouter les événements du contrat
      // pour déterminer si la réponse est correcte, puisque le hash de la réponse est stocké en privé
      // dans le contrat et ne peut pas être accédé directement.
      
      // Pour déboguer, générer des hashs pour des réponses communes
      this.logger.log('Hashs pour des réponses communes:');
      const commonAnswers = ['42', 'hello', 'world', 'ethereum', 'blockchain', 'smart contract', 'zama', 'fhe', 'privacy', 'crypto', 'answer', 'solution', 'correct', 'true', 'false', 'yes', 'no', 'maybe', 'secret', 'password'];
      for (const commonAnswer of commonAnswers) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(commonAnswer));
        this.logger.log(`${commonAnswer}: ${hash}`);
      }
      
      // Essayer de simuler une transaction pour voir si elle réussirait
      // Ce n'est pas une vérification parfaite, mais peut donner un indice
      try {
        // Créer un portefeuille factice pour la simulation
        const wallet = ethers.Wallet.createRandom().connect(this.provider);
        const contractWithSigner = this.contract.connect(wallet) as unknown as OnchainRiddleContract;
        
        // Simuler la transaction sans l'exécuter
        // Dans ethers.js v6, on utilise estimateGas pour vérifier si la transaction réussirait
        await this.contract.getFunction('submitAnswer').estimateGas(answer, { from: wallet.address });
        
        // Si nous sommes arrivés ici, la transaction réussirait probablement
        this.logger.log('La simulation de transaction a réussi, la réponse pourrait être correcte');
        return true;
      } catch (simulationError) {
        // Si la simulation a échoué, la réponse est probablement incorrecte
        this.logger.log('La simulation de transaction a échoué, la réponse est probablement incorrecte:', simulationError);
        return false;
      }
    } catch (error) {
      this.logger.error('Erreur lors de la vérification de la réponse:', error);
      return false;
    }
  }
  
  /**
   * Prépare les données de transaction pour MetaMask pour soumettre une réponse au contrat
   * Retourne les données nécessaires pour que le frontend crée une transaction avec MetaMask
   * @throws Error si l'énigme n'est pas active
   */
  async prepareMetaMaskTransaction(answer: string): Promise<{
    to: string;
    data: string;
    chainId: number;
    networkName: string;
    currencyName: string;
    rpcUrl: string;
    blockExplorer: string;
  }> {
    try {
      // Vérifier si l'énigme est active avant de préparer la transaction
      const isActive = await this.contract.isActive() as boolean;
      if (!isActive) {
        const errorMsg = '[EthereumService] Tentative de préparation d\'une transaction pour une énigme inactive';
        this.logger.error(errorMsg);
        console.error(errorMsg);
        
        // Émettre l'erreur via Socket.IO pour afficher un toast sur le frontend
        this.socketService.emitBlockchainError(errorMsg);
        
        throw new Error(errorMsg);
      }
      
      // Encoder les données d'appel de fonction pour submitAnswer
      const callData = this.contract.interface.encodeFunctionData('submitAnswer', [answer]);
      
      // Retourner les paramètres de transaction nécessaires pour MetaMask
      return {
        to: RIDDLE_CONTRACT_ADDRESS,
        data: callData,
        chainId: ACTIVE_CHAIN_ID,
        networkName: ACTIVE_NETWORK_NAME,
        currencyName: ACTIVE_CURRENCY_NAME,
        rpcUrl: ACTIVE_RPC_URL,
        blockExplorer: ACTIVE_BLOCK_EXPLORER
      };
    } catch (error) {
      const errorMsg = `[EthereumService] Erreur lors de la préparation de la transaction MetaMask: ${error.message}`;
      this.logger.error(errorMsg);
      console.error(errorMsg);
      
      // Émettre l'erreur via Socket.IO pour afficher un toast sur le frontend
      this.socketService.emitBlockchainError(errorMsg);
      
      // Propager l'erreur avec le message formaté pour que le frontend puisse la gérer
      throw new Error(errorMsg);
    }
  }
  
  /**
   * Soumet une réponse au contrat
   * Cela modifiera l'état de la blockchain si la réponse est correcte
   */
  async submitAnswer(answer: string, walletKey?: string): Promise<boolean> {
    try {
      // Si une clé de portefeuille est fournie, l'utiliser pour créer un signataire
      // Sinon, ce sera un appel en lecture seule
      let signer;
      if (walletKey) {
        signer = new ethers.Wallet(walletKey, this.provider);
      } else {
        // À des fins de test uniquement - en production, vous auriez besoin d'un vrai portefeuille
        this.logger.warn('Aucune clé de portefeuille fournie, utilisation du mode lecture seule');
        return await this.checkAnswer(answer);
      }
      
      // Créer une instance de contrat avec le signataire
      const contractWithSigner = this.contract.connect(signer) as unknown as OnchainRiddleContract;
      
      // Soumettre la réponse au contrat
      const tx = await contractWithSigner.submitAnswer(answer);
      
      // Attendre que la transaction soit minée
      const receipt = await tx.wait();
      
      // Vérifier si la transaction a réussi
      if (receipt && receipt.status === 1) {
        // Vérifier si nous sommes devenus le gagnant
        const winner = await this.contract.winner() as string;
        const isWinner = winner.toLowerCase() === signer.address.toLowerCase();
        
        this.logger.log(`Réponse soumise avec succès. Est gagnant: ${isWinner}`);
        return isWinner;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Erreur lors de la soumission de la réponse au contrat:', error);
      return false;
    }
  }
}