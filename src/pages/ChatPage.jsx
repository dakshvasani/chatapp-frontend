// src/pages/ChatPage.jsx
import { useAuthStore } from '../store/useAuthStore';
import { useSocketStore } from '../store/useSocketStore';
import { useInitSocket } from '../hooks/useInitSocket';

function ChatPage() {
  const { user, clearAuth } = useAuthStore();
  const onlineUsers = useSocketStore((state) => state.onlineUsers);

  useInitSocket();

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Chat Dashboard</h1>
      <p>Logged in as: <strong>{user?.username}</strong></p>
      <p>Online user IDs: {onlineUsers.length > 0 ? onlineUsers.join(', ') : 'Just you'}</p>
      <button onClick={clearAuth} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
        Logout
      </button>
    </div>
  );
}

export default ChatPage;