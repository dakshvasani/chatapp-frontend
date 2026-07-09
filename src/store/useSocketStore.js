// src/store/useSocketStore.js
import { create } from 'zustand';

export const useSocketStore = create((set, get) => ({
  onlineUsers: [],
  typingUsers: {}, // { [userId]: true }

  setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),

  addOnlineUser: (userId) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.includes(userId)
        ? state.onlineUsers
        : [...state.onlineUsers, userId],
    })),

  removeOnlineUser: (userId) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((id) => id !== userId),
    })),

  setUserTyping: (userId) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [userId]: true },
    })),

  setUserStopTyping: (userId) =>
    set((state) => {
      const updated = { ...state.typingUsers };
      delete updated[userId];
      return { typingUsers: updated };
    }),
}));