"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_RANDOM_RIDDLE, CHECK_ANSWER, RIDDLE_SOLVED_SUBSCRIPTION } from "@/graphql/queries";
import { getSocketClient } from "@/lib/socket-client";
import MetaMaskButton from "@/components/MetaMaskButton";

export default function Home() {
  const [riddle, setRiddle] = useState({ id: "", question: "Loading riddle..." });
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [playerCount, setPlayerCount] = useState(0);
  const [playerId, setPlayerId] = useState("");
  const [solvedBy, setSolvedBy] = useState("");
  const [wrongAnswer, setWrongAnswer] = useState({ playerNumber: 0, answer: "", visible: false });
  const [duplicateAnswer, setDuplicateAnswer] = useState({ playerNumber: 0, answer: "", visible: false });
  
  const { loading, error, data, subscribeToMore } = useQuery(GET_RANDOM_RIDDLE);
  const [checkAnswer] = useMutation(CHECK_ANSWER);

  useEffect(() => {
    const socket = getSocketClient();
    
    if (socket) {
      setPlayerId(socket.id);
      
      socket.on('currentRiddle', (data: { id: string; question: string }) => {
        setRiddle(data);
      });
      
      socket.on('playerCount', (count) => {
        setPlayerCount(count);
      });
      
      socket.on('newRiddle', (data) => {
        setRiddle({ id: data.id, question: data.question });
        setSolvedBy(data.solvedBy);
        setAnswer("");
        
        setTimeout(() => {
          setSolvedBy("");
        }, 5000);
      });
      
      socket.on('answerResponse', (response) => {
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
    }
    
    return () => {
      if (socket) {
        socket.off('currentRiddle');
        socket.off('playerCount');
        socket.off('newRiddle');
        socket.off('answerResponse');
        socket.off('wrongAnswer');
        socket.off('duplicateAnswer');
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
    const unsubscribe = subscribeToMore({
      document: RIDDLE_SOLVED_SUBSCRIPTION,
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;
        
        const { solvedBy, newRiddle } = subscriptionData.data.riddleSolved;
        
        setSolvedBy(solvedBy);
        setRiddle({
          id: newRiddle.id,
          question: newRiddle.question
        });
        
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
        
        {solvedBy && (
          <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 p-3 rounded-md text-center text-sm">
            {solvedBy === playerId ? 'You solved the riddle!' : 'Someone solved the riddle!'}
          </div>
        )}
        
        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg">
          <h2 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Riddle:</h2>
          <p className="text-gray-800 dark:text-white font-medium">{riddle.question}</p>
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
          
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Submit Answer
          </button>
          
          {/* MetaMask Button for onchain riddles */}
          <MetaMaskButton 
            riddleId={riddle.id} 
            answer={answer}
            onSuccess={() => setMessage("Réponse soumise à la blockchain avec succès!")} 
            onError={(error) => setMessage(`Erreur: ${error}`)} 
          />
        </form>
        
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
      </main>
      
      <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Riddle Game - Real-time multiplayer with WebSockets and GraphQL</p>
      </footer>
    </div>
  );
}
