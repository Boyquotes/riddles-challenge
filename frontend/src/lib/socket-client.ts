import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocketClient() {
  if (!socket && typeof window !== 'undefined') {
    socket = io('http://localhost:3001');
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
