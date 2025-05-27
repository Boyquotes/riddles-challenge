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
    // setTimeout(() => {
    //   this.testEmitBlockchainError();
    // }, 10000);
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
          
          // Émettre une notification selon le résultat de la tentative
          if (correct === true) {
            this.logger.log('Réponse correcte détectée, envoi de notification de succès aux clients');
            this.socketService.emitBlockchainSuccess('Riddle solved!');
            
            // Planifier la définition de la prochaine énigme après 5 secondes
            this.logger.log('Planification de la définition de la prochaine énigme dans 5 secondes...');
            console.log('=== PLANIFICATION DE LA PROCHAINE ÉNIGME DANS 5 SECONDES ===');
            
            setTimeout(() => {
              this.logger.log('Délai de 2 secondes écoulé, appel de setRandomRiddle...');
              console.log('=== DÉLAI DE 2 SECONDES ÉCOULÉ, DÉFINITION DE LA NOUVELLE ÉNIGME ===');
              
              // Émettre un événement pour que le service Riddles puisse définir la prochaine énigme
              this.eventEmitter.emit('riddle.setNext', { 
                timestamp: new Date().toISOString(),
                source: 'answerAttemptListener'
              });
            }, 2000); // 2 secondes de délai
          } else {
            this.logger.log('Réponse incorrecte détectée, envoi de notification aux clients');
            this.socketService.emitBlockchainError('Énigme non résolue. La réponse soumise est incorrecte.');
          }
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
   * Récupère les données brutes de l'énigme depuis le contrat
   * @deprecated Utiliser getRiddleWithRetry à la place pour une meilleure gestion des erreurs
   */
  async getRiddleRaw(): Promise<{ question: string; isActive: boolean; winner: string }> {
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
   * Récupère l'énigme actuelle sur la blockchain avec un mécanisme de timeout et de retry
   * @returns Un objet contenant la question, si l'énigme est active et le gagnant
   */
  async getRiddleWithRetry(): Promise<{ question: string; isActive: boolean; winner: string }> {
    const maxRetries = 3;
    const timeoutMs = 5000; // 5 secondes de timeout par tentative
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Récupération de l'énigme (tentative ${attempt}/${maxRetries})...`);
        
        // Créer une promesse avec timeout
        const result = await Promise.race([
          // Promesse 1: Récupération des données
          (async () => {
            // Vérifier si l'énigme est active
            const isActive = await this.contract.isActive() as boolean;
            
            // Récupérer la question de l'énigme
            const riddleQuestion = await this.contract.riddle() as string;
            
            // Récupérer l'adresse du gagnant (adresse zéro si pas de gagnant)
            const winner = await this.contract.winner() as string;
            
            this.logger.log(`Énigme actuelle: "${riddleQuestion}", active: ${isActive}, gagnant: ${winner}`);
            
            return {
              question: riddleQuestion || 'Chargement de l\'\u00e9nigme...',
              isActive,
              winner
            };
          })(),
          
          // Promesse 2: Timeout
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Timeout après ${timeoutMs}ms lors de la tentative ${attempt}`));
            }, timeoutMs);
          })
        ]);
        
        // Si on arrive ici, la récupération a réussi
        return result as { question: string; isActive: boolean; winner: string };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Erreur lors de la tentative ${attempt}: ${error.message}`);
        
        // Attendre un peu avant la prochaine tentative (backoff exponentiel)
        if (attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.log(`Attente de ${backoffMs}ms avant la prochaine tentative...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    // Si toutes les tentatives ont échoué
    this.logger.error(`Toutes les tentatives ont échoué après ${maxRetries} essais`);
    if (lastError) {
      this.logger.error(`Dernière erreur: ${lastError.message}`);
    }
    
    // Retourner une réponse par défaut en cas d'échec
    return {
      question: 'Impossible de récupérer l\'\u00e9nigme. Veuillez réessayer plus tard.',
      isActive: false,
      winner: '0x0000000000000000000000000000000000000000'
    };
  }
  
  /**
   * Récupère l'énigme actuelle sur la blockchain
   * @returns Un objet contenant l'ID et la question de l'énigme, ou null si aucune énigme n'est définie
   */
  async getCurrentRiddle(): Promise<{ id: string; question: string } | null> {
    try {
      this.logger.log('Récupération de l\'\u00e9nigme actuelle sur la blockchain...');
      
      // Utiliser la méthode getRiddleWithRetry avec retry et timeout
      const riddleData = await this.getRiddleWithRetry();
      
      // Si l'énigme n'est pas active, retourner null
      if (!riddleData.isActive) {
        this.logger.log('Aucune énigme active sur la blockchain');
        return null;
      }
      
      // Si la question est vide, retourner null
      if (!riddleData.question || riddleData.question.trim() === '') {
        this.logger.log('L\'\u00e9nigme sur la blockchain est vide');
        return null;
      }
      
      this.logger.log(`Énigme actuelle sur la blockchain: "${riddleData.question}"`);
      
      // Retourner l'énigme avec l'ID 'onchain'
      return {
        id: 'onchain',
        question: riddleData.question
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de l\'\u00e9nigme sur la blockchain:', error);
      return null;
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
      console.log('callData', callData);
      this.logger.log('callData', callData);
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
      console.log('walletKey', walletKey);
      console.log('this.provider', this.provider);
      console.log('this.contract', this.contract);
      console.log('answer', answer);
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

  /**
   * Définit une nouvelle énigme dans le contrat
   * @param riddle Le texte de l'énigme
   * @param answerHash Le hash keccak256 de la réponse
   * @param walletKey Clé privée du portefeuille pour signer la transaction (optionnel pour le mode local)
   * @returns true si l'énigme a été définie avec succès, false sinon
   */
  async setRiddle(riddle: string, answerHash: string, walletKey?: string): Promise<boolean> {
    try {
      console.log('=== DÉBUT DE LA MÉTHODE setRiddle ===');
      console.log(`Tentative de définition de l'énigme: "${riddle}"`);
      console.log(`Hash de réponse fourni: ${answerHash}`);
      console.log(`Clé privée fournie: ${walletKey ? 'Oui (masquée)' : 'Non'}`);
      
      // Vérifier le mode réseau et les paramètres de configuration
      const networkMode = process.env.NETWORK_MODE || 'testnet';
      const contractAddress = process.env.CONTRACT_ADDRESS || 'non défini';
      const chainId = process.env.ACTIVE_CHAIN_ID || 'non défini';
      const rpcUrl = process.env.ACTIVE_RPC_URL || 'non défini';
      
      console.log('=== CONFIGURATION RÉSEAU ===');
      console.log(`Mode réseau: ${networkMode}`);
      console.log(`Adresse du contrat: ${contractAddress}`);
      console.log(`Chain ID: ${chainId}`);
      console.log(`RPC URL: ${rpcUrl}`);
      
      // Si une clé de portefeuille est fournie, l'utiliser pour créer un signataire
      // Sinon, simuler l'opération en mode local
      let signer;
      if (walletKey) {
        console.log('Utilisation de la clé privée fournie pour créer un signataire');
        signer = new ethers.Wallet(walletKey, this.provider);
        console.log(`Adresse du signataire: ${signer.address}`);
      } else {
        // En mode local ou pour les tests, on peut utiliser un portefeuille aléatoire
        this.logger.warn('Aucune clé de portefeuille fournie, utilisation d\'un portefeuille aléatoire (mode local uniquement)');
        console.log('ATTENTION: Création d\'un portefeuille aléatoire (ne fonctionnera qu\'en mode local)');
        signer = ethers.Wallet.createRandom().connect(this.provider);
        console.log(`Adresse du portefeuille aléatoire: ${signer.address}`);
      }
      
      // Vérifier le solde du signataire
      try {
        const balance = await this.provider.getBalance(signer.address);
        console.log(`Solde du signataire: ${ethers.formatEther(balance)} ETH`);
        if (balance.toString() === '0') {
          console.log('AVERTISSEMENT: Le signataire n\'a pas de fonds pour payer les frais de transaction!');
        }
      } catch (balanceError) {
        console.error('Erreur lors de la vérification du solde:', balanceError);
      }
      
      // Créer une instance de contrat avec le signataire
      console.log('Connexion du contrat avec le signataire...');
      const contractWithSigner = this.contract.connect(signer) as unknown as OnchainRiddleContract;
      
      // Vérifier si le hash est au bon format (bytes32)
      let formattedAnswerHash = answerHash;
      if (!answerHash.startsWith('0x')) {
        console.log('Ajout du préfixe 0x au hash de réponse');
        formattedAnswerHash = '0x' + answerHash;
      }
      
      // S'assurer que la longueur est correcte pour bytes32
      if (formattedAnswerHash.length !== 66) { // '0x' + 64 caractères
        const errorMsg = 'Le hash de la réponse doit être au format bytes32 (32 octets)';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log(`Hash de réponse formaté: ${formattedAnswerHash}`);
      
      // Définir l'énigme dans le contrat
      console.log('Envoi de la transaction setRiddle au contrat...');
      const tx = await contractWithSigner.setRiddle(riddle, formattedAnswerHash);
      console.log(`Transaction envoyée avec succès! Hash de transaction: ${tx.hash}`);
      
      // Attendre que la transaction soit minée
      console.log('Attente de la confirmation de la transaction...');
      const receipt = await tx.wait();
      console.log('Transaction confirmée!');
      console.log(`Statut de la transaction: ${receipt.status}`);
      console.log(`Bloc: ${receipt.blockNumber}`);
      console.log(`Gas utilisé: ${receipt.gasUsed.toString()}`);
      
      // Vérifier si la transaction a réussi
      if (receipt && receipt.status === 1) {
        const successMsg = `Énigme définie avec succès: "${riddle}" avec le hash de réponse: ${formattedAnswerHash}`;
        this.logger.log(successMsg);
        console.log(successMsg);
        console.log('=== FIN DE LA MÉTHODE setRiddle (SUCCÈS) ===');
        return true;
      }
      
      console.log('Transaction confirmée mais avec un statut d\'échec');
      console.log('=== FIN DE LA MÉTHODE setRiddle (ÉCHEC) ===');
      return false;
    } catch (error) {
      this.logger.error('Erreur lors de la définition de l\'énigme dans le contrat:', error);
      console.error('=== ERREUR DANS LA MÉTHODE setRiddle ===');
      console.error(`Message d'erreur: ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
      
      // Vérifier si l'erreur est liée à une transaction rejetée
      if (error.code && error.reason) {
        console.error(`Code d'erreur: ${error.code}`);
        console.error(`Raison: ${error.reason}`);
      }
      
      console.log('=== FIN DE LA MÉTHODE setRiddle (ERREUR) ===');
      return false;
    }
  }

  /**
   * Récupère les statistiques des joueurs depuis le contrat
   * @returns Un objet contenant les statistiques des joueurs (adresse -> nombre de victoires)
   */
  async getPlayerStatistics(): Promise<{ [address: string]: number }> {
    try {
      // Récupérer l'historique des événements Winner depuis le contrat
      const filter = this.contract.filters.Winner();
      const events = await this.contract.queryFilter(filter);
      
      // Compter les victoires par adresse
      const playerStats: { [address: string]: number } = {};
      
      for (const event of events) {
        // Utiliser le type EventLog pour accéder aux arguments
        const eventLog = event as unknown as ethers.EventLog;
        if (eventLog && eventLog.args && eventLog.args.length > 0) {
          const winner = eventLog.args[0] as string;
          if (winner && winner !== ethers.ZeroAddress) {
            if (!playerStats[winner]) {
              playerStats[winner] = 0;
            }
            playerStats[winner]++;
          }
        }
      }
      
      this.logger.log(`Statistiques des joueurs récupérées: ${JSON.stringify(playerStats)}`);
      return playerStats;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des statistiques des joueurs:', error);
      return {};
    }
  }
  
  /**
   * Définit la prochaine énigme dans le contrat lorsqu'une énigme est résolue
   * @param nextRiddles Tableau des prochaines énigmes disponibles
   * @param walletKey Clé privée du portefeuille pour signer la transaction
   * @returns true si l'énigme a été définie avec succès, false sinon
   */
  async setNextRiddle(nextRiddles: Array<{ text: string, answer: string }>, walletKey?: string): Promise<boolean> {
    try {
      // Vérifier s'il y a des énigmes disponibles
      if (!nextRiddles || nextRiddles.length === 0) {
        this.logger.warn('Aucune énigme disponible pour définir la prochaine énigme');
        return false;
      }
      
      // Sélectionner une énigme aléatoire parmi les disponibles
      const randomIndex = Math.floor(Math.random() * nextRiddles.length);
      const selectedRiddle = nextRiddles[randomIndex];
      
      // Calculer le hash de la réponse
      const answerBytes = ethers.toUtf8Bytes(selectedRiddle.answer);
      const answerHash = ethers.keccak256(answerBytes);
      
      // Définir l'énigme dans le contrat
      const success = await this.setRiddle(selectedRiddle.text, answerHash, walletKey);
      
      if (success) {
        this.logger.log(`Prochaine énigme définie avec succès: "${selectedRiddle.text}"`);
        // Émettre une notification via Socket.IO
        this.socketService.emitBlockchainSuccess('Nouvelle énigme définie sur la blockchain!');
      }
      
      return success;
    } catch (error) {
      this.logger.error('Erreur lors de la définition de la prochaine énigme:', error);
      return false;
    }
  }
}