import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocketClient() {
  if (!socket && typeof window !== 'undefined') {
    console.log('Initializing Socket.IO client connection to http://localhost:3001');
    
    // Créer une connexion Socket.IO avec des options explicites
    socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    // Écouteurs d'événements pour le débogage
    socket.on('connect', () => {
      console.log('Socket.IO connected successfully with ID:', socket?.id);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
    });
    
    // Écouteur spécifique pour les erreurs blockchain
    socket.on('blockchainErrorNotification', (data) => {
      console.log('Blockchain error notification received in socket-client.ts:', data);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
