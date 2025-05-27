"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_RANDOM_RIDDLE, CHECK_ANSWER, RIDDLE_SOLVED_SUBSCRIPTION, GET_GAME_STATS } from "@/graphql/queries";
import { getSocketClient } from "@/lib/socket-client";
import MetaMaskButton from "@/components/MetaMaskButton";
import ResetGameButton from "@/components/ResetGameButton";

export default function Home() {
  const [riddle, setRiddle] = useState({ id: "", question: "Loading riddle..." });
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [playerCount, setPlayerCount] = useState(0);
  const [playerId, setPlayerId] = useState("");
  const [solvedBy, setSolvedBy] = useState("");
  const [wrongAnswer, setWrongAnswer] = useState({ playerNumber: 0, answer: "", visible: false });
  const [duplicateAnswer, setDuplicateAnswer] = useState({ playerNumber: 0, answer: "", visible: false });
  const [blockchainError, setBlockchainError] = useState({ message: "", visible: false });
  const [blockchainSuccess, setBlockchainSuccess] = useState({ message: "", visible: false });
  const [riddleSolved, setRiddleSolved] = useState(false);
  const [riddleIndex, setRiddleIndex] = useState(0);
  const [nextRiddleLoading, setNextRiddleLoading] = useState(false);
  const [nextRiddleCountdown, setNextRiddleCountdown] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverStats, setGameOverStats] = useState<any>(null);
  
  const { loading, error, data, subscribeToMore } = useQuery(GET_RANDOM_RIDDLE);
  const { data: statsData } = useQuery(GET_GAME_STATS, {
    pollInterval: 10000, // Rafraîchir les statistiques toutes les 10 secondes
  });
  const [checkAnswer] = useMutation(CHECK_ANSWER);

  useEffect(() => {
    const socket = getSocketClient();
    
    if (socket) {
      console.log('Socket.IO client initialized with ID:', socket.id);
      if (socket.id) {
        setPlayerId(socket.id);
      }
      
      // Add a connect event listener to debug connection issues
      socket.on('connect', () => {
        console.log('Connected to server');
      });
      
      // Add a disconnect event listener
      socket.on('disconnect', (reason) => {
        console.log('Socket.IO disconnected:', reason);
      });
      
      // Add a connect_error event listener
      socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
      });
      
      socket.on('currentRiddle', (data: { id: string; question: string }) => {
        console.log(`Received currentRiddle event:`, data);
        setRiddle(data);
      });
      
      socket.on('playerCount', (count) => {
        console.log(`Received playerCount event: ${count} players`);
        setPlayerCount(count);
      });
      
      socket.on('newRiddle', (data) => {
        console.log(`Received newRiddle event via Socket.IO:`, data);
        setRiddle({
          id: data.id,
          question: data.question
        });
        setSolvedBy(data.solvedBy);
        setRiddleSolved(false);
        
        console.log(`Updated riddle state: id=${data.id}, question="${data.question}", solvedBy=${data.solvedBy}`);
        
        setTimeout(() => {
          setSolvedBy("");
        }, 5000);
      });
      
      socket.on('answerResponse', (response) => {
        console.log(`Received answerResponse event:`, response);
        setMessage(response.message);
        
        setTimeout(() => {
          setMessage("");
        }, 3000);
      });
      
      socket.on('wrongAnswer', (data) => {
        setWrongAnswer({
          playerNumber: data.playerNumber,
          answer: data.answer,
          visible: true
        });
        
        // Hide the wrong answer notification after 3 seconds
        setTimeout(() => {
          setWrongAnswer(prev => ({ ...prev, visible: false }));
        }, 3000);
      });
      
      socket.on('duplicateAnswer', (data) => {
        setDuplicateAnswer({
          playerNumber: data.playerNumber,
          answer: data.answer,
          visible: true
        });
        
        // Hide the duplicate answer notification after 3 seconds
        setTimeout(() => {
          setDuplicateAnswer(prev => ({ ...prev, visible: false }));
        }, 3000);
      });
      
      // Listen for blockchain error notifications
      socket.on('blockchainErrorNotification', (data) => {
        console.log('Blockchain error notification received:', data);
        // Alert for debugging purposes
        // alert(`Blockchain error: ${data.error}`);
        
        setBlockchainError({
          message: data.error,
          visible: true
        });
        
        // Hide the blockchain error notification after 7 seconds
        setTimeout(() => {
          setBlockchainError(prev => ({ ...prev, visible: false }));
        }, 7000);
      });
      
      // Listen for blockchain success notifications
      socket.on('blockchainSuccessNotification', (data) => {
        console.log('Blockchain success notification received:', data);
        
        setBlockchainSuccess({
          message: data.message,
          visible: true
        });
        
        // Hide the blockchain success notification after 7 seconds
        setTimeout(() => {
          setBlockchainSuccess(prev => ({ ...prev, visible: false }));
        }, 7000);
      });
      
      // Listen for game over event
      socket.on('gameOver', (data) => {
        console.log('Game over event received:', data);
        
        setGameOver(true);
        setGameOverStats(data);
        
        // Afficher le message de fin de jeu
        setRiddle({
          id: 'game_over',
          question: 'Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.'
        });
        
        // Afficher également une notification de succès
        setBlockchainSuccess({
          message: 'Félicitations ! Vous avez résolu toutes les énigmes. Le jeu est terminé.',
          visible: true
        });
      });
    }
    
    return () => {
      if (socket) {
        socket.off('currentRiddle');
        socket.off('playerCount');
        socket.off('newRiddle');
        socket.off('answerResponse');
        socket.off('wrongAnswer');
        socket.off('duplicateAnswer');
        socket.off('blockchainErrorNotification');
        socket.off('blockchainSuccessNotification');
        socket.off('gameOver');
      }
    };
  }, []);
  
  useEffect(() => {
    if (data?.randomRiddle) {
      setRiddle({
        id: data.randomRiddle.id,
        question: data.randomRiddle.question
      });
    }
  }, [data]);
  
  useEffect(() => {
    console.log('Initialisation de la souscription GraphQL pour RIDDLE_SOLVED_SUBSCRIPTION');
    
    if (!subscribeToMore) {
      console.error('subscribeToMore n\'est pas disponible');
      return;
    }
    
    // Utiliser try-catch pour éviter les problèmes avec les stack frames de Next.js
    try {
      const unsubscribe = subscribeToMore({
        document: RIDDLE_SOLVED_SUBSCRIPTION,
        onError: (error: any) => {
          // Gérer explicitement les erreurs de souscription
          console.error('Erreur dans la souscription GraphQL:', error);
        },
        updateQuery: (prev: any, { subscriptionData }: { subscriptionData: any }) => {
          try {
            console.log('Événement de souscription GraphQL reçu:', subscriptionData);
            
            if (!subscriptionData.data) {
              console.log('Aucune donnée dans la souscription');
              return prev;
            }
            
            const { solvedBy, newRiddle } = subscriptionData.data.riddleSolved;
            console.log(`Énigme résolue par: ${solvedBy}`);
            console.log(`Nouvelle énigme:`, newRiddle);
            
            // Utiliser setTimeout pour éviter les problèmes de rendu avec React
            setTimeout(() => {
              try {
                setSolvedBy(solvedBy);
                
                // Vérifier que newRiddle contient toutes les propriétés nécessaires
                if (newRiddle && newRiddle.id && newRiddle.question) {
                  setRiddle({
                    id: newRiddle.id,
                    question: newRiddle.question
                  });
                  console.log(`État de l'énigme mis à jour: id=${newRiddle.id}, question="${newRiddle.question}"`);
                } else {
                  console.error('newRiddle incomplet:', newRiddle);
                }
                
                // Si l'énigme a été résolue par un joueur (pas par le système)
                if (solvedBy && solvedBy !== 'system') {
                  console.log('Énigme résolue par un joueur, affichage du compte à rebours pour la prochaine énigme');
                  // Afficher le message indiquant qu'une nouvelle énigme sera bientôt disponible
                  setNextRiddleLoading(true);
                  setNextRiddleCountdown(4);
                }
              } catch (stateError) {
                console.error('Erreur lors de la mise à jour de l\'\u00e9tat React:', stateError);
              }
            }, 0);
            
            // Retourner prev pour éviter les erreurs de mise à jour du cache Apollo
            return prev;
          } catch (updateError) {
            console.error('Erreur dans updateQuery:', updateError);
            return prev;
          }
        }
      });
      
      // Nettoyer la souscription
      return () => {
        try {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        } catch (cleanupError) {
          console.error('Erreur lors du nettoyage de la souscription:', cleanupError);
        }
      };
    } catch (subscriptionError) {
      console.error('Erreur lors de l\'initialisation de la souscription:', subscriptionError);
      return () => {}; // Retourner une fonction de nettoyage vide
    }
  }, [subscribeToMore]);
  
  // Gérer le compte à rebours séparément pour éviter les problèmes de rendu
  useEffect(() => {
    if (nextRiddleLoading && nextRiddleCountdown > 0) {
      const countdownInterval = setInterval(() => {
        setNextRiddleCountdown(prev => {
          if (prev <= 1) {
            console.log('Compte à rebours terminé');
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      console.log('Compte à rebours démarré');
      
      // Après 4 secondes, réinitialiser l'état
      setTimeout(() => {
        console.log('Délai de 4 secondes écoulé, réinitialisation de l\'\u00e9tat');
        setNextRiddleLoading(false);
        clearInterval(countdownInterval);
      }, 4000);
      
      // Nettoyer l'intervalle si le composant est démonté
      return () => {
        clearInterval(countdownInterval);
      };
    }
  }, [nextRiddleLoading, nextRiddleCountdown]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!answer.trim()) return;
    
    const socket = getSocketClient();
    if (socket) {
      socket.emit('submitAnswer', { answer: answer.trim() });
    }
    
    // We'll use WebSockets only for answer submission to avoid Apollo errors
    // The GraphQL mutation is only used for subscriptions and other operations
    // No need to call the checkAnswer mutation directly
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-indigo-950 p-4">
      <main className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Riddle Game</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{playerCount} player{playerCount !== 1 ? 's' : ''} online</p>
          
          {/* Compteur d'énigmes */}
          {statsData?.gameOverStats?.stats && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-1 mt-2">
              <p className="font-medium">Énigmes résolues: {statsData.gameOverStats.stats.totalRiddlesSolved}</p>
              <p className="flex justify-center space-x-2">
                <span className="text-blue-500 dark:text-blue-400">Onchain: {statsData.gameOverStats.stats.onchainRiddlesSolved}</span>
                <span>•</span>
                <span className="text-green-500 dark:text-green-400">Local: {statsData.gameOverStats.stats.localRiddlesSolved}</span>
              </p>
            </div>
          )}
        </div>

        {/* Afficher les statistiques de fin de jeu si toutes les énigmes sont résolues */}
        {gameOver && gameOverStats ? (
          <div className="bg-green-100 border border-green-500 rounded-lg p-4 text-center">
            <h2 className="text-xl font-bold text-green-700 mb-2">Félicitations !</h2>
            <p className="text-green-700 mb-4">Vous avez résolu toutes les énigmes. Le jeu est terminé.</p>
            
            <div className="bg-white p-3 rounded-lg mb-3 text-left">
              <h3 className="font-bold mb-1">Statistiques :</h3>
              <p>Énigmes résolues : {gameOverStats.stats?.totalRiddlesSolved || 0}</p>
              <p>Énigmes onchain : {gameOverStats.stats?.onchainRiddlesSolved || 0}</p>
              <p>Énigmes locales : {gameOverStats.stats?.localRiddlesSolved || 0}</p>
            </div>
            
            {gameOverStats.playerStats && (
              <div className="bg-white p-3 rounded-lg text-left">
                <h3 className="font-bold mb-1">Classement des joueurs :</h3>
                <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">{gameOverStats.message}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              {riddle.id === 'game_over' ? 'Game Over' : 'Riddle'}
            </h2>
            
            {solvedBy && (
              <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 p-3 rounded-md text-center text-sm">
                {solvedBy === playerId ? 'You solved the riddle!' : solvedBy === 'system' ? 'A new riddle has been set!' : 'Someone solved the riddle!'}
              </div>
            )}
          
          {nextRiddleLoading && (
            <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 p-3 rounded-md text-center text-sm mt-2 animate-pulse">
              Nouvelle énigme dans {nextRiddleCountdown} seconde{nextRiddleCountdown !== 1 ? 's' : ''}...
            </div>
          )}
          
          <div className={`mt-4 ${riddle.id === 'game_over' ? 'text-yellow-600 dark:text-yellow-400 font-medium whitespace-pre-line' : 'text-gray-700 dark:text-gray-300'}`}>
            {riddle.question}
          </div>
        </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="answer" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your Answer:
            </label>
            <input
              type="text"
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="Type your answer here"
            />
          </div>
          
          {/* MetaMask Button for onchain riddles */}
          <MetaMaskButton 
            riddleId={riddle.id} 
            answer={answer}
            onSuccess={() => {
              setMessage("Réponse soumise à la blockchain!");
              // Set riddleSolved to true when a riddle is solved via MetaMask
              setRiddleSolved(true);
              // Increment the riddle index for the next riddle
              setRiddleIndex((prevIndex) => (prevIndex + 1) % 5);
            }} 
            onError={(error) => setMessage(`Erreur: ${error}`)} 
          />
        </form>
        
        {/* Show ResetGameButton when all riddles are solved */}
        {(riddle.id === 'game_over' || gameOver || 
          (statsData?.gameOverStats?.stats && 
           statsData.gameOverStats.stats.totalRiddlesSolved > 0 && 
           statsData.gameOverStats.playerStats?.length > 0)) && (
          <div className="mt-4">
            <p className="text-center text-sm text-amber-600 dark:text-amber-400 mb-2">
              Toutes les énigmes disponibles ont été résolues. Vous pouvez réinitialiser le jeu pour recommencer.
            </p>
            <ResetGameButton 
              onSuccess={() => {
                setMessage("Le jeu a été réinitialisé avec succès!");
                setGameOver(false);
                // Rafraîchir la page après 1 seconde pour obtenir une nouvelle énigme
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
              }}
              onError={(error) => setMessage(`Erreur: ${error}`)}
            />
          </div>
        )}
        
        {message && (
          <div className={`p-3 rounded-md text-center text-sm ${message.includes('Correct') ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
            {message}
          </div>
        )}
        
        {wrongAnswer.visible && (
          <div className="p-3 rounded-md text-center text-sm bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 mt-2">
            Player {wrongAnswer.playerNumber} tried: "{wrongAnswer.answer}" - Wrong answer!
          </div>
        )}
        
        {duplicateAnswer.visible && (
          <div className="p-3 rounded-md text-center text-sm bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 mt-2">
            Player {duplicateAnswer.playerNumber} tried: "{duplicateAnswer.answer}" - This answer was already tried!
          </div>
        )}
        
        {blockchainError.visible && (
          <div className="p-3 rounded-md text-center text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 mt-2 font-bold">
            Erreur Blockchain: {blockchainError.message}
          </div>
        )}
        
        {blockchainSuccess.visible && (
          <div className="p-3 rounded-md text-center text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mt-2 font-bold">
            {blockchainSuccess.message}
          </div>
        )}
      </main>
      
      <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Riddle Game - Real-time on-chain multiplayer</p>
      </footer>
    </div>
  );
}
