// src/store/useChatStore.js
import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (conversation) => set({ activeConversation: conversation, messages: [] }),
  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => {
      // Only append if it belongs to the currently open conversation
      if (state.activeConversation?._id !== message.conversation) return state;
      return { messages: [...state.messages, message] };
    }),

  updateLastMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId ? { ...c, lastMessage: message } : c
      ),
    })),
}));