// src/pages/ChatPage.jsx
import { useEffect, useState, useRef } from 'react';
import axiosInstance from '../api/axiosInstance';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useSocketStore } from '../store/useSocketStore';
import { useInitSocket } from '../hooks/useInitSocket';
import { getSocket } from '../lib/socket';

function ChatPage() {
  const { user, clearAuth } = useAuthStore();
  const onlineUsers = useSocketStore((state) => state.onlineUsers);
  const typingUsers = useSocketStore((state) => state.typingUsers);

  const {
    conversations,
    setConversations,
    activeConversation,
    setActiveConversation,
    messages,
    setMessages,
    addMessage,
    updateLastMessage,
  } = useChatStore();

  const [allUsers, setAllUsers] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  useInitSocket();

  // Fetch all users to start new conversations
  useEffect(() => {
    axiosInstance.get('/users').then((res) => setAllUsers(res.data.users));
  }, []);

  // Fetch existing conversations
  useEffect(() => {
    axiosInstance.get('/conversations').then((res) => setConversations(res.data.conversations));
  }, []);

  // Listen for incoming real-time messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (message) => {
      addMessage(message);
      updateLastMessage(message.conversation, message);
    };

    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, [activeConversation]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (otherUserId) => {
    const res = await axiosInstance.post('/conversations', { participantId: otherUserId });
    const conversation = res.data.conversation;
    setActiveConversation(conversation);

    const msgRes = await axiosInstance.get(`/messages/${conversation._id}`);
    setMessages(msgRes.data.messages);
  };

  const getOtherParticipant = (conversation) =>
    conversation.participants.find((p) => p._id !== user.id);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null); // no preview for video/docs, just show filename
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageText.trim() && !selectedFile) return;
    if (!activeConversation) return;

    const receiverId = getOtherParticipant(activeConversation)?._id;

    const formData = new FormData();
    formData.append('conversationId', activeConversation._id);
    formData.append('text', messageText);
    if (selectedFile) {
      formData.append('file', selectedFile); // 'file' must match multer's upload.single('file')
    }

    try {
      setIsSending(true);
      const res = await axiosInstance.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessages([...messages, res.data.message]);

      setMessageText('');
      clearSelectedFile();
      getSocket()?.emit('stop_typing', { receiverId });
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    if (!activeConversation) return;

    const receiverId = getOtherParticipant(activeConversation)?._id;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('typing', { receiverId });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { receiverId });
    }, 1500);
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <strong>{user?.username}</strong>
          <button onClick={clearAuth} style={styles.logoutBtn}>Logout</button>
        </div>

        <h4 style={{ padding: '0 1rem' }}>All Users</h4>
        {allUsers.map((u) => (
          <div key={u._id} style={styles.userItem} onClick={() => openConversation(u._id)}>
            <span style={{ color: onlineUsers.includes(u._id) ? 'green' : '#999' }}>●</span>{' '}
            {u.username}
          </div>
        ))}
      </div>

      {/* Chat window */}
      <div style={styles.chatWindow}>
        {activeConversation ? (
          <>
            <div style={styles.chatHeader}>
              {getOtherParticipant(activeConversation)?.username}
              {typingUsers[getOtherParticipant(activeConversation)?._id] && (
                <span style={{ fontSize: '0.85rem', color: '#888', marginLeft: '0.5rem' }}>
                  typing...
                </span>
              )}
            </div>

            <div style={styles.messagesArea}>
              {messages.map((msg, i) => (
                <div
                  key={msg._id || i}
                  style={{
                    ...styles.messageBubble,
                    alignSelf: msg.sender._id === user.id ? 'flex-end' : 'flex-start',
                    backgroundColor: msg.sender._id === user.id ? '#DCF8C6' : '#fff',
                  }}
                >
                  {msg.media?.url && msg.media.type === 'image' && (
                    <img
                      src={msg.media.url}
                      alt="shared"
                      style={{ maxWidth: '220px', borderRadius: '6px', display: 'block' }}
                    />
                  )}
                  {msg.media?.url && msg.media.type === 'video' && (
                    <video
                      src={msg.media.url}
                      controls
                      style={{ maxWidth: '220px', borderRadius: '6px', display: 'block' }}
                    />
                  )}
                  {msg.media?.url && msg.media.type === 'document' && (
                    <a href={msg.media.url} target="_blank" rel="noopener noreferrer">
                      📄 {msg.media.fileName}
                    </a>
                  )}
                  {msg.text && (
                    <div style={{ marginTop: msg.media?.url ? '0.4rem' : 0 }}>{msg.text}</div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {selectedFile && (
              <div style={styles.filePreviewBar}>
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="preview"
                    style={{ height: '50px', borderRadius: '4px' }}
                  />
                ) : (
                  <span>📄 {selectedFile.name}</span>
                )}
                <button onClick={clearSelectedFile} style={{ marginLeft: '0.5rem' }}>✕</button>
              </div>
            )}

            <form onSubmit={handleSend} style={styles.inputArea}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="fileInput"
              />
              <label htmlFor="fileInput" style={styles.attachBtn}>📎</label>

              <input
                value={messageText}
                onChange={handleTyping}
                placeholder="Type a message..."
                style={styles.input}
              />
              <button type="submit" disabled={isSending} style={styles.sendBtn}>
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ padding: '2rem', color: '#888' }}>
            Select a user to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', height: '100vh', fontFamily: 'sans-serif' },
  sidebar: { width: '280px', borderRight: '1px solid #ddd', overflowY: 'auto' },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid #ddd',
  },
  logoutBtn: { fontSize: '0.8rem', cursor: 'pointer' },
  userItem: { padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' },
  chatWindow: { flex: 1, display: 'flex', flexDirection: 'column' },
  chatHeader: { padding: '1rem', borderBottom: '1px solid #ddd', fontWeight: 'bold' },
  messagesArea: {
    flex: 1,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    overflowY: 'auto',
    backgroundColor: '#ECE5DD',
  },
  messageBubble: {
    padding: '0.5rem 0.8rem',
    borderRadius: '8px',
    maxWidth: '60%',
  },
  inputArea: {
    display: 'flex',
    padding: '1rem',
    borderTop: '1px solid #ddd',
    gap: '0.5rem',
    alignItems: 'center',
  },
  input: { flex: 1, padding: '0.6rem', fontSize: '1rem' },
  sendBtn: { padding: '0.6rem 1.2rem', cursor: 'pointer' },
  attachBtn: {
    cursor: 'pointer',
    fontSize: '1.3rem',
    display: 'flex',
    alignItems: 'center',
    padding: '0 0.5rem',
  },
  filePreviewBar: {
    padding: '0.5rem 1rem',
    display: 'flex',
    alignItems: 'center',
    borderTop: '1px solid #ddd',
  },
};

export default ChatPage;
