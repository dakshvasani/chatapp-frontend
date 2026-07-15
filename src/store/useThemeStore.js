// src/store/useThemeStore.js
import { create } from 'zustand';

const getInitialTheme = () => {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useThemeStore = create((set, get) => ({
  theme: getInitialTheme(),

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    set({ theme: newTheme });
  },

  initTheme: () => {
    const theme = get().theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },
}));
