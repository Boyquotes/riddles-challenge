import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { SET_SPECIFIC_RIDDLE_ONCHAIN } from '@/graphql/queries';

interface SetNewRiddleButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  riddleIndex?: number;
}

export default function SetNewRiddleButton({ 
  onSuccess, 
  onError, 
  riddleIndex = 0 
}: SetNewRiddleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [setSpecificRiddle] = useMutation(SET_SPECIFIC_RIDDLE_ONCHAIN);
  const [selectedIndex, setSelectedIndex] = useState(riddleIndex);

  const handleSetNewRiddle = async () => {
    setIsLoading(true);
    try {
      const { data } = await setSpecificRiddle({ 
        variables: { index: selectedIndex } 
      });
      
      if (data?.setSpecificRiddleOnchain) {
        if (onSuccess) onSuccess();
      } else {
        if (onError) onError('Échec de la définition de l\'énigme sur la blockchain');
      }
    } catch (error: any) {
      console.error('Erreur lors de la définition de l\'énigme:', error);
      if (onError) onError(error.message || 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
      <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
        Définir une nouvelle énigme sur la blockchain
      </h3>
      
      <div className="flex items-center space-x-2 mb-3">
        <label htmlFor="riddleIndex" className="text-xs text-blue-700 dark:text-blue-300">
          Index de l'énigme:
        </label>
        <select
          id="riddleIndex"
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className="text-xs bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>Énigme #0 - Keyboard</option>
          <option value={1}>Énigme #1 - Echo</option>
          <option value={2}>Énigme #2 - Footsteps</option>
          <option value={3}>Énigme #3 - Penny</option>
          <option value={4}>Énigme #4 - Towel</option>
        </select>
      </div>
      
      <button
        onClick={handleSetNewRiddle}
        disabled={isLoading}
        className={`w-full text-sm font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
          isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Définition en cours...
          </>
        ) : (
          'Définir nouvelle énigme'
        )}
      </button>
      
      <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
        Cette action définira une nouvelle énigme sur la blockchain, remplaçant l'énigme actuelle.
      </p>
    </div>
  );
}
