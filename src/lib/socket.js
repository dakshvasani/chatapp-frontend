// src/lib/socket.js
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';

let socket = null;

export const connectSocket = () => {
  const token = useAuthStore.getState().accessToken;

  if (!token) {
    console.warn('Cannot connect socket: no access token');
    return null;
  }

  socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token },
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;