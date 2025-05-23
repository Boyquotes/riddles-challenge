import { useState, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client';
import { PREPARE_METAMASK_TRANSACTION } from '@/graphql/queries';

interface MetaMaskButtonProps {
  riddleId: string;
  answer: string;
  onSuccess?: () => void;
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
  const [isOnchainRiddle, setIsOnchainRiddle] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [prepareTransaction, { loading, error, data }] = useLazyQuery(PREPARE_METAMASK_TRANSACTION);

  useEffect(() => {
    // Check if the riddle is an onchain riddle
    setIsOnchainRiddle(riddleId === 'onchain');
    
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
    if (!isConnected || !account || !answer) return;
    
    setIsLoading(true);
    
    try {
      // Get transaction data from backend
      await prepareTransaction({ variables: { answer } });
      
      if (data?.prepareMetaMaskTransaction) {
        const txData = data.prepareMetaMaskTransaction;
        
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
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      console.error('Error submitting answer to blockchain:', error);
      if (onError) onError(error.message || 'Failed to submit answer to blockchain');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show the button if it's not an onchain riddle
  if (!isOnchainRiddle) {
    return null;
  }

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
