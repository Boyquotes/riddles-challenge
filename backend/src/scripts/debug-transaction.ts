import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Charger les variables d'environnement
dotenv.config();

// Configuration
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const HARDHAT_RPC_URL = process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545/';
const NETWORK_MODE = process.env.NETWORK_MODE || 'testnet';
const ACTIVE_RPC_URL =NETWORK_MODE === 'local' ? HARDHAT_RPC_URL : SEPOLIA_RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xA6FDC30159443F08a76dcAc0469A7d6B0dE878d2';

// ABI simplifié du contrat OnchainRiddle
const RIDDLE_CONTRACT_ABI = [
  "function riddle() external view returns (string memory)",
  "function isActive() external view returns (bool)",
  "function winner() external view returns (address)",
  "function submitAnswer(string memory answer) external",
  "event Winner(address indexed winner)",
  "event AnswerAttempt(address indexed user, bool correct)"
];

// Configuration des logs
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, `debug-transaction-${new Date().toISOString().replace(/:/g, '-')}.log`);

// Fonction pour écrire dans le fichier de log
async function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} ${message}\n`;
  fs.appendFileSync(logFile, logEntry);
  console.log(message);
}

// Fonction principale de débogage
async function debugTransaction() {
  try {
    await writeLog('=== Démarrage du débogage de transaction ===');
    
    // Créer un provider pour se connecter à Sepolia
    await writeLog(`Connexion au RPC: ${ACTIVE_RPC_URL}`);
    const provider = new ethers.JsonRpcProvider(ACTIVE_RPC_URL);
    
    // Créer une instance du contrat
    await writeLog(`Connexion au contrat: ${CONTRACT_ADDRESS}`);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, RIDDLE_CONTRACT_ABI, provider);
    
    // Vérifier l'état actuel du contrat
    const riddleText = await contract.riddle();
    const isActive = await contract.isActive();
    const winner = await contract.winner();
    
    await writeLog('État actuel du contrat:');
    await writeLog(`- Énigme: ${riddleText}`);
    await writeLog(`- Active: ${isActive}`);
    await writeLog(`- Gagnant: ${winner}`);
    
    // Calculer le hash de la réponse "simple"
    // const answer = 'simple';
    const answer = 'keyboard';
    const answerHash = ethers.keccak256(ethers.toUtf8Bytes(answer));
    await writeLog(`\nRéponse à tester: "${answer}"`);
    await writeLog(`Hash keccak256: ${answerHash}`);
    
    // Créer un portefeuille pour la simulation
    if (!process.env.PRIVATE_KEY) {
      await writeLog('\nAucune clé privée trouvée dans les variables d\'environnement. Création d\'un portefeuille aléatoire pour la simulation...');
      const wallet = ethers.Wallet.createRandom().connect(provider);
      await writeLog(`Portefeuille créé: ${wallet.address}`);
      
      // Configurer les écouteurs d'événements
      await writeLog('\nConfiguration des écouteurs d\'événements...');
      
      contract.on('Winner', (...args) => {
        try {
          const winner = args[0];
          writeLog(`\nÉvénement Winner détecté! Gagnant: ${winner}`);
          writeLog(`Arguments complets: ${JSON.stringify(args)}`);
        } catch (error) {
          writeLog(`\nErreur lors du traitement de l'événement Winner: ${error.message}`);
          writeLog(`Type d'arguments: ${typeof args}, Est un tableau: ${Array.isArray(args)}`);
          if (args) {
            try {
              writeLog(`Arguments bruts: ${args.toString()}`);
            } catch (e) {
              writeLog(`Impossible de convertir les arguments en string: ${e.message}`);
            }
          }
        }
      });
      
      contract.on('AnswerAttempt', (...args) => {
        try {
          const user = args[0];
          const correct = args[1];
          writeLog(`\nÉvénement AnswerAttempt détecté! Utilisateur: ${user}, Correct: ${correct}`);
          writeLog(`Arguments complets: ${JSON.stringify(args)}`);
        } catch (error) {
          writeLog(`\nErreur lors du traitement de l'événement AnswerAttempt: ${error.message}`);
          writeLog(`Type d'arguments: ${typeof args}, Est un tableau: ${Array.isArray(args)}`);
        }
      });
      
      // Simuler une transaction
      await writeLog('\nSimulation de la transaction submitAnswer...');
      try {
        const contractWithSigner = contract.connect(wallet);
        
        // Encoder les données d'appel pour la simulation
        const callData = contract.interface.encodeFunctionData('submitAnswer', [answer]);
        await writeLog(`Données d'appel: ${callData}`);
        
        // Estimer le gaz pour vérifier si la transaction réussirait
        await writeLog('\nEstimation du gaz pour vérifier si la transaction réussirait...');
        try {
          // Utiliser la méthode getFunction pour accéder à la fonction du contrat
          const gasEstimate = await contractWithSigner.getFunction('submitAnswer').estimateGas(answer);
          await writeLog(`Estimation de gaz réussie: ${gasEstimate} unités de gaz`);
          await writeLog('La transaction réussirait probablement, la réponse pourrait être correcte.');
        } catch (estimateError) {
          await writeLog(`Échec de l'estimation de gaz: ${estimateError.message}`);
          
          // Vérifier si l'erreur contient des informations sur la raison de l'échec
          if (estimateError.message.includes('execution reverted')) {
            await writeLog('La transaction échouerait, la réponse est probablement incorrecte.');
          } else {
            await writeLog('Erreur inattendue lors de l\'estimation du gaz.');
          }
        }
      } catch (error) {
        await writeLog(`Erreur lors de la simulation: ${error.message}`);
      }
    } else {
      // Si une clé privée est disponible, essayer une vraie transaction (attention: coûte des frais réels)
      await writeLog('\nClé privée trouvée dans les variables d\'environnement.');
      await writeLog('Pour exécuter une transaction réelle, décommentez le code dans le script.');
      
      // Le code pour une transaction réelle est commenté pour éviter des dépenses accidentelles

      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      await writeLog(`Utilisation du portefeuille: ${wallet.address}`);
      
      const contractWithSigner = contract.connect(wallet);
      
      // Configurer les écouteurs d'événements
      await writeLog('\nConfiguration des écouteurs d\'événements...');
      
      contract.on('Winner', (...args) => {
        try {
          const winner = args[0];
          writeLog(`\nÉvénement Winner détecté! Gagnant: ${winner}`);
          writeLog(`Arguments complets: ${JSON.stringify(args)}`);
        } catch (error) {
          writeLog(`\nErreur lors du traitement de l'événement Winner: ${error.message}`);
          writeLog(`Type d'arguments: ${typeof args}, Est un tableau: ${Array.isArray(args)}`);
        }
      });
      
      // Soumettre la réponse au contrat
      await writeLog('\nSoumission de la réponse au contrat...');
      try {
        const tx = await contractWithSigner.getFunction('submitAnswer')(answer);
        await writeLog(`Transaction envoyée: ${tx.hash}`);
        
        // Attendre que la transaction soit minée
        await writeLog('Attente de la confirmation de la transaction...');
        const receipt = await tx.wait();
        
        // Vérifier si la transaction a réussi
        if (receipt && receipt.status === 1) {
          await writeLog('Transaction réussie!');
          
          // Vérifier les événements
          if (receipt.logs && receipt.logs.length > 0) {
            await writeLog(`Nombre d'événements: ${receipt.logs.length}`);
            
            for (let i = 0; i < receipt.logs.length; i++) {
              const log = receipt.logs[i];
              try {
                const parsedLog = contract.interface.parseLog(log);
                await writeLog(`Événement ${i+1}: ${parsedLog.name}`);
                await writeLog(`Arguments: ${JSON.stringify(parsedLog.args)}`);
              } catch (parseError) {
                await writeLog(`Impossible de parser l'événement ${i+1}: ${parseError.message}`);
              }
            }
          } else {
            await writeLog('Aucun événement trouvé dans la transaction.');
          }
          
          // Vérifier si nous sommes devenus le gagnant
          const newWinner = await contract.winner();
          const isWinner = newWinner.toLowerCase() === wallet.address.toLowerCase();
          await writeLog(`Nouveau gagnant: ${newWinner}`);
          await writeLog(`Sommes-nous le gagnant? ${isWinner}`);
        } else {
          await writeLog('La transaction a échoué.');
        }
      } catch (txError) {
        await writeLog(`Erreur lors de la transaction: ${txError.message}`);
      }
    }
    
    await writeLog('\n=== Fin du débogage de transaction ===');
  } catch (error) {
    await writeLog(`Erreur globale: ${error.message}`);
    if (error.stack) {
      await writeLog(`Stack: ${error.stack}`);
    }
  }
}

// Exécuter la fonction de débogage
debugTransaction().catch(error => {
  console.error('Erreur non gérée:', error);
});
