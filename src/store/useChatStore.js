// src/store/useChatStore.js
import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (conversation) =>
    set({ activeConversation: conversation, messages: [] }),

  // Supports BOTH:
  //   setMessages(newArray)                — direct replacement
  //   setMessages((prevMessages) => ...)    — functional update, like React's useState
  // This matches how the socket event handlers in ChatPage.jsx call it.
  setMessages: (messagesOrUpdater) =>
    set((state) => ({
      messages:
        typeof messagesOrUpdater === 'function'
          ? messagesOrUpdater(state.messages)
          : messagesOrUpdater,
    })),

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