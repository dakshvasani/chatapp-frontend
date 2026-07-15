// src/hooks/useInitSocket.js
import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useSocketStore } from '../store/useSocketStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';

export const useInitSocket = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { setOnlineUsers, addOnlineUser, removeOnlineUser, setUserTyping, setUserStopTyping } =
    useSocketStore();

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }
    

    const socket = connectSocket();
    if (!socket) return;

    socket.on('online_users', (userIds) => {
      setOnlineUsers(userIds);
    });

    socket.on('user_online', ({ userId }) => {
      addOnlineUser(userId);
    });

    socket.on('user_offline', ({ userId }) => {
      removeOnlineUser(userId);
    });

    socket.on('user_typing', ({ senderId }) => {
      setUserTyping(senderId);
    });

    socket.on('user_stop_typing', ({ senderId }) => {
      setUserStopTyping(senderId);
    });

    return () => {
      const activeSocket = getSocket();
      if (activeSocket) {
        activeSocket.off('online_users');
        activeSocket.off('user_online');
        activeSocket.off('user_offline');
        activeSocket.off('user_typing');
        activeSocket.off('user_stop_typing');
      }
    };
  }, [isAuthenticated]);
};