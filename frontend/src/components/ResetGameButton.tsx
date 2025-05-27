import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { RESET_GAME } from '@/graphql/queries';

interface ResetGameButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function ResetGameButton({ 
  onSuccess, 
  onError
}: ResetGameButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [resetGame] = useMutation(RESET_GAME);

  const handleResetGame = async () => {
    // if (confirm('Êtes-vous sûr de vouloir réinitialiser le jeu ? Cela définira la première énigme pour tous les joueurs.')) {
      setIsLoading(true);
      try {
        const { data } = await resetGame();
        
        if (data?.resetGame) {
          if (onSuccess) onSuccess();
        } else {
          if (onError) onError('Échec de la réinitialisation du jeu');
        }
      } catch (error: any) {
        console.error('Erreur lors de la réinitialisation du jeu:', error);
        if (onError) onError(error.message || 'Erreur inconnue');
      } finally {
        setIsLoading(false);
      }
    // }
  };

  return (
    <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
      <h3 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
        Réinitialiser le jeu
      </h3>
      
      <button
        onClick={handleResetGame}
        disabled={isLoading}
        className={`w-full text-sm font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors ${
          isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Réinitialisation en cours...
          </>
        ) : (
          'Réinitialiser le jeu'
        )}
      </button>
      
      <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
        Cette action réinitialisera le jeu pour tous les joueurs en définissant la première énigme du tableau.
      </p>
    </div>
  );
}
