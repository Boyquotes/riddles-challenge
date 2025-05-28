import { useState, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client';
import { PREPARE_METAMASK_TRANSACTION } from '@/graphql/queries';
import { getSocketClient } from '@/lib/socket-client';

interface MetaMaskButtonProps {
  riddleId: string;
  answer: string;
  onSuccess?: (hideMessage?: boolean) => void;
  onError?: (error: string) => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function MetaMaskButton({ riddleId, answer, onSuccess, onError }: MetaMaskButtonProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [prepareTransaction, { loading, error, data }] = useLazyQuery(PREPARE_METAMASK_TRANSACTION);

  useEffect(() => {
    
    // Check if MetaMask is installed
    if (typeof window !== 'undefined' && window.ethereum) {
      // Check if user is already connected
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setIsConnected(true);
            setAccount(accounts[0]);
          }
        })
        .catch((err: Error) => {
          console.error('Error checking MetaMask connection:', err);
        });
      
      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setIsConnected(true);
          setAccount(accounts[0]);
        } else {
          setIsConnected(false);
          setAccount(null);
        }
      });
    }
  }, [riddleId]);

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMask is not installed. Please install it to use this feature.');
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setIsConnected(true);
      setAccount(accounts[0]);
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      if (onError) onError('Failed to connect to MetaMask');
    }
  };
  
  const disconnectWallet = () => {
    // Note: MetaMask doesn't actually provide a way to disconnect programmatically
    // We can only reset our app's state
    setIsConnected(false);
    setAccount(null);
  };

  const submitAnswerToBlockchain = async () => {
    console.log('FUNCTION CALLED: submitAnswerToBlockchain');
    console.log('isConnected:', isConnected);
    console.log('account:', account);
    console.log('answer:', answer); 
    if (!isConnected || !account || !answer) return;
    
    setIsLoading(true);
    
    try {
      console.log('Answer:', answer);
      // Get transaction data from backend
      const result = await prepareTransaction({ variables: { answer } });
      const txData = result.data?.prepareMetaMaskTransaction;
      console.log('Transaction data:', txData);

      if (txData) {
        
        // Check if we're on the right network (Sepolia)
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (parseInt(chainId, 16) !== txData.chainId) {
          // Try to switch to Sepolia
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x' + txData.chainId.toString(16) }],
            });
          } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
              try {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: '0x' + txData.chainId.toString(16),
                    chainName: txData.networkName || 'Ethereum Network',
                    nativeCurrency: {
                      name: txData.currencyName || 'ETH',
                      symbol: 'ETH',
                      decimals: 18
                    },
                    rpcUrls: [txData.rpcUrl || 'http://127.0.0.1:8545/'],
                    blockExplorerUrls: [txData.blockExplorer || '']
                  }],
                });
              } catch (addError) {
                throw new Error('Failed to add Sepolia network to MetaMask');
              }
            } else {
              throw switchError;
            }
          }
        }
        
        // Send transaction
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: account,
            to: txData.to,
            data: txData.data,
          }],
        });
        
        console.log('Transaction sent:', txHash);
        
        // For MetaMask transactions, we can't easily access the transaction receipt
        // or listen for events directly in the frontend
        // So we'll show a success message for the transaction submission
        if (onSuccess) {
          // Show a more generic success message for transaction submission
          onSuccess();
          
          // Faire disparaître le message après 2 secondes
          setTimeout(() => {
            // Appeler onSuccess avec un paramètre vide pour indiquer de masquer le message
            onSuccess(true);
          }, 4000);
        }
      }
    } catch (error: any) {
      // Log detailed error information for debugging
      console.log('Transaction error details:', {
        errorType: typeof error,
        errorCode: error.code,
        errorMessage: error.message,
        errorData: error.data,
        errorStack: error.stack,
        fullError: JSON.stringify(error, (key, value) => {
          if (key === 'stack') return undefined; // Exclude stack from stringification to avoid circular references
          return value;
        }, 2)
      });
      
      // Always log the raw error message to ensure it's visible in the console
      console.error('Raw error message:', error.message);
      
      // Handle specific error cases
      if (error.code === 4001) {
        // User rejected the transaction
        console.log('User rejected the transaction');
        if (onError) onError('Transaction rejected by user');
      } else if (error.message) {
        console.log('Transaction error detected:', error.message);
        
        // Check for specific error messages related to inactive riddle
        if (error.message.includes('[EthereumService] Tentative de préparation d\'une transaction pour une énigme inactive') ||
            error.message.includes('No active riddle') || 
            error.message.includes('Tentative de préparation d\'une transaction pour une énigme inactive') ||
            error.message.includes('Erreur lors de la préparation de la transaction MetaMask') ||
            error.message.includes('énigme inactive') ||
            error.message.includes('enigme inactive') ||
            error.message.includes('Enigme inactive') ||
            error.message.toLowerCase().includes('inactive') && error.message.toLowerCase().includes('enigme') ||
            error.message.toLowerCase().includes('inactive') && error.message.toLowerCase().includes('énigme')) {
          console.log('Inactive riddle error detected:', error.message);
          
          // Use the exact error message if it contains the EthereumService prefix
          const errorMessage = error.message.includes('[EthereumService]') 
            ? error.message 
            : 'Il n\'y a pas d\'énigme active sur la blockchain actuellement.';
          
          // Send the error to the server via Socket.IO
          const socket = getSocketClient();
          if (socket) {
            socket.emit('blockchainError', { error: errorMessage });
          }
          
          if (onError) onError(errorMessage);
        }
        // Check for execution reverted errors
        else if (error.message.includes('execution reverted') || error.message.includes('Internal JSON-RPC error')) {
          // Check if the error message contains any indication that the transaction was successful
          // This is a workaround for the case where the transaction actually succeeded but we got an error
          if (error.message.includes('Winner') || error.message.includes('results is not iterable')) {
            // This might be a false negative - the transaction might have succeeded
            // The "results is not iterable" error often happens when the transaction succeeds but the event processing fails
            console.log('Transaction might have succeeded despite error. Treating as success.');
            console.log('Error message indicating possible success:', error.message);
            if (onSuccess) onSuccess();
          } else {
            // Transaction reverted - likely wrong answer
            console.log('Transaction likely failed due to incorrect answer');
            if (onError) onError('Incorrect answer. Please try again with a different answer.');
          }
        } else {
          // Generic error handling
          console.log('Unhandled transaction error:', error.message);
          if (onError) onError(error.message || 'Failed to submit answer to blockchain');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Debug logs to check component state
  console.log('MetaMaskButton Render State:', {
    isConnected,
    account,
    answer,
    isLoading
  });

  return (
    <div className="mt-4">
      {!isConnected ? (
        <button
          onClick={connectWallet}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32.9582 1L19.8241 10.7183L22.2665 5.09944L32.9582 1Z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2.04187 1L15.0217 10.809L12.7334 5.09944L2.04187 1Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M28.2344 23.6586L24.7461 28.9534L32.2645 30.9954L34.4156 23.7921L28.2344 23.6586Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M0.599609 23.7921L2.73508 30.9954L10.2535 28.9534L6.7652 23.6586L0.599609 23.7921Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9.86294 14.7221L7.8125 17.9207L15.2311 18.2689L14.9771 10.2283L9.86294 14.7221Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M25.1377 14.7221L19.9449 10.1376L19.8242 18.2689L27.2428 17.9207L25.1377 14.7221Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.2534 28.9534L14.7232 26.7885L10.9458 23.8631L10.2534 28.9534Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.2773 26.7885L24.7472 28.9534L24.0547 23.8631L20.2773 26.7885Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Connecter MetaMask
        </button>
      ) : (
        <div className="space-y-3">
          <button
            onClick={submitAnswerToBlockchain}
            disabled={isLoading || !answer}
            className={`w-full font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors flex items-center justify-center ${
              isLoading || !answer
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Envoi en cours...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M32.9582 1L19.8241 10.7183L22.2665 5.09944L32.9582 1Z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.04187 1L15.0217 10.809L12.7334 5.09944L2.04187 1Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Soumettre à la blockchain
              </>
            )}
          </button>
          
          <button
            onClick={disconnectWallet}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            Déconnecter
          </button>
        </div>
      )}
      {account && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center truncate">
          Connecté: {account.substring(0, 6)}...{account.substring(account.length - 4)}
        </div>
      )}
    </div>
  );
}
