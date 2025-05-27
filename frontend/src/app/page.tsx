"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_RANDOM_RIDDLE, CHECK_ANSWER, RIDDLE_SOLVED_SUBSCRIPTION } from "@/graphql/queries";
import { getSocketClient } from "@/lib/socket-client";
import MetaMaskButton from "@/components/MetaMaskButton";
import SetNewRiddleButton from "@/components/SetNewRiddleButton";
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
  
  const { loading, error, data, subscribeToMore } = useQuery(GET_RANDOM_RIDDLE);
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
    const unsubscribe = subscribeToMore({
      document: RIDDLE_SOLVED_SUBSCRIPTION,
      updateQuery: (prev, { subscriptionData }) => {
        console.log('Événement de souscription GraphQL reçu:', subscriptionData);
        
        if (!subscriptionData.data) {
          console.log('Aucune donnée dans la souscription');
          return prev;
        }
        
        const { solvedBy, newRiddle } = subscriptionData.data.riddleSolved;
        console.log(`Énigme résolue par: ${solvedBy}`);
        console.log(`Nouvelle énigme:`, newRiddle);
        
        setSolvedBy(solvedBy);
        setRiddle({
          id: newRiddle.id,
          question: newRiddle.question
        });
        console.log(`État de l'énigme mis à jour: id=${newRiddle.id}, question="${newRiddle.question}"`);
        
        // Si l'énigme a été résolue par un joueur (pas par le système)
        if (solvedBy !== 'system') {
          console.log('Énigme résolue par un joueur, affichage du compte à rebours pour la prochaine énigme');
          // Afficher le message indiquant qu'une nouvelle énigme sera bientôt disponible
          setNextRiddleLoading(true);
          setNextRiddleCountdown(4);
          
          // Démarrer le compte à rebours
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
            console.log('Délai de 4 secondes écoulé, réinitialisation de l\'état');
            setNextRiddleLoading(false);
            clearInterval(countdownInterval);
          }, 4000);
        } else {
          console.log('Énigme définie par le système, pas de compte à rebours nécessaire');
        }
        
        // Set riddleSolved to true to show the SetNewRiddleButton
        setRiddleSolved(true);
        
        // Increment the riddle index for the next riddle (cycling through available riddles)
        setRiddleIndex((prevIndex) => (prevIndex + 1) % 5);
        
        setTimeout(() => {
          setSolvedBy("");
        }, 5000);
        
        return prev;
      }
    });
    
    return () => unsubscribe();
  }, [subscribeToMore]);
  
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
        </div>

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
          
          {/* <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Submit Answer
          </button> */}
          
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
        
        {/* Show SetNewRiddleButton when a riddle is solved */}
        {riddleSolved && (
          <SetNewRiddleButton 
            riddleIndex={riddleIndex}
            onSuccess={() => {
              setMessage("Nouvelle énigme définie avec succès sur la blockchain!");
              setRiddleSolved(false);
            }}
            onError={(error) => setMessage(`Erreur: ${error}`)}
          />
        )}
        
        {/* Show ResetGameButton when all riddles are solved (game_over state) */}
        {riddle.id === 'game_over' && (
          <ResetGameButton 
            onSuccess={() => {
              setMessage("Le jeu a été réinitialisé avec succès!");
            }}
            onError={(error) => setMessage(`Erreur: ${error}`)}
          />
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
        
        {/* Test button for debugging - only visible in development */}
        {/* <button 
          onClick={() => {
            setBlockchainError({
              message: "[Test] Tentative de préparation d'une transaction pour une énigme inactive",
              visible: true
            });
            setTimeout(() => {
              setBlockchainError(prev => ({ ...prev, visible: false }));
            }, 7000);
          }}
          className="mt-4 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs rounded">
          Test Blockchain Error
        </button> */}
      </footer>
    </div>
  );
}
