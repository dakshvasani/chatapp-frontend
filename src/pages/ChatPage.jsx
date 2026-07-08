// src/pages/ChatPage.jsx
import { useAuthStore } from '../store/useAuthStore';

function ChatPage() {
  const { user, clearAuth } = useAuthStore();

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Chat Dashboard</h1>
      <p>Logged in as: <strong>{user?.username}</strong></p>
      <button onClick={clearAuth} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
        Logout
      </button>
    </div>
  );
}

export default ChatPage;