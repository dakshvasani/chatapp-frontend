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

  // Day 7 additions
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

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

  // Single combined socket-listener effect (new_message, messages_seen, message_edited, message_deleted)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (message) => {
      addMessage(message);
      updateLastMessage(message.conversation, message);
    };

    const handleMessagesSeen = ({ conversationId }) => {
      if (activeConversation?._id !== conversationId) return;
      setMessages((prevMessages) =>
        prevMessages.map((m) => (m.conversation === conversationId ? { ...m, status: 'seen' } : m))
      );
    };

    const handleMessageEdited = (updatedMessage) => {
      setMessages((prevMessages) =>
        prevMessages.map((m) => (m._id === updatedMessage._id ? updatedMessage : m))
      );
    };

    const handleMessageDeleted = ({ messageId, conversationId }) => {
      if (activeConversation?._id !== conversationId) return;
      setMessages((prevMessages) => prevMessages.filter((m) => m._id !== messageId));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('messages_seen', handleMessagesSeen);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('messages_seen', handleMessagesSeen);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [activeConversation]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (otherUserId) => {
    const res = await axiosInstance.post('/conversations', { participantId: otherUserId });
    const conversation = res.data.conversation;
    setActiveConversation(conversation);
    setSearchQuery('');
    setSearchResults(null);
    setReplyingTo(null);
    setEditingMessage(null);

    const msgRes = await axiosInstance.get(`/messages/${conversation._id}`);
    setMessages(msgRes.data.messages);

    // Tell the backend we've now seen this conversation's messages
    getSocket()?.emit('mark_seen', { conversationId: conversation._id });
  };

  // Guarded: participants may momentarily be unpopulated ObjectId strings instead of
  // full user objects (e.g. if a backend route ever returns them unpopulated).
  // Optional chaining here prevents a full white-screen crash if that happens.
  const getOtherParticipant = (conversation) =>
    conversation?.participants?.find((p) => p?._id && p._id !== user.id);

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
    if (replyingTo) {
      formData.append('replyTo', replyingTo._id);
    }
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
      setReplyingTo(null);
      if (receiverId) {
        getSocket()?.emit('stop_typing', { receiverId });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    if (!activeConversation) return;

    const receiverId = getOtherParticipant(activeConversation)?._id;
    const socket = getSocket();
    if (!socket || !receiverId) return;

    socket.emit('typing', { receiverId });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { receiverId });
    }, 1500);
  };

  const handleEditSave = async () => {
    if (!editText.trim() || !editingMessage) return;

    const res = await axiosInstance.put(`/messages/${editingMessage._id}`, { text: editText });

    setMessages(messages.map((m) => (m._id === editingMessage._id ? res.data.message : m)));

    setEditingMessage(null);
    setEditText('');
  };

  const handleDelete = async (messageId) => {
    if (!confirm('Delete this message?')) return;
    await axiosInstance.delete(`/messages/${messageId}`);
    setMessages(messages.filter((m) => m._id !== messageId));
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    const res = await axiosInstance.get(`/messages/${activeConversation._id}/search`, {
      params: { q: query },
    });
    setSearchResults(res.data.messages);
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
              <span>
                {getOtherParticipant(activeConversation)?.username || 'Unknown user'}
                {typingUsers[getOtherParticipant(activeConversation)?._id] && (
                  <span style={{ fontSize: '0.85rem', color: '#888', marginLeft: '0.5rem' }}>
                    typing...
                  </span>
                )}
              </span>
              <input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={handleSearch}
                style={styles.searchInput}
              />
            </div>

            {searchResults && (
              <div style={styles.searchResultsBar}>
                <strong>{searchResults.length} result(s)</strong>
                {searchResults.map((m) => (
                  <div key={m._id} style={{ padding: '0.4rem 0', fontSize: '0.85rem' }}>
                    <strong>{m.sender?.username || 'Unknown'}:</strong> {m.text}
                  </div>
                ))}
              </div>
            )}

            <div style={styles.messagesArea}>
              {messages.map((msg, i) => {
                const isMine = msg.sender?._id === user.id;
                return (
                  <div
                    key={msg._id || i}
                    style={{
                      ...styles.messageBubble,
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                      backgroundColor: isMine ? '#DCF8C6' : '#fff',
                    }}
                  >
                    {msg.replyTo && (
                      <div style={styles.quotedMessage}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                          {msg.replyTo?.sender?.username || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#555' }}>
                          {msg.replyTo?.text || '📎 Media'}
                        </div>
                      </div>
                    )}

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

                    {editingMessage?._id === msg._id ? (
                      <div>
                        <input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          style={{ width: '100%', marginBottom: '0.3rem' }}
                        />
                        <button onClick={handleEditSave} style={styles.smallBtn}>Save</button>
                        <button onClick={() => setEditingMessage(null)} style={styles.smallBtn}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      msg.text && (
                        <div style={{ marginTop: msg.media?.url ? '0.4rem' : 0 }}>
                          {msg.text}
                          {msg.isEdited && (
                            <span style={{ fontSize: '0.65rem', color: '#999' }}> (edited)</span>
                          )}
                        </div>
                      )
                    )}

                    <div style={styles.messageActions}>
                      <button onClick={() => setReplyingTo(msg)} style={styles.actionBtn}>
                        ↩ Reply
                      </button>
                      {isMine && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMessage(msg);
                              setEditText(msg.text);
                            }}
                            style={styles.actionBtn}
                          >
                            ✎ Edit
                          </button>
                          <button
                            onClick={() => handleDelete(msg._id)}
                            style={{ ...styles.actionBtn, color: '#c00' }}
                          >
                            🗑 Delete
                          </button>
                          <span style={{ fontSize: '0.7rem', color: '#888', marginLeft: '0.4rem' }}>
                            {msg.status === 'seen' ? '✓✓ Seen' : msg.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {replyingTo && (
              <div style={styles.replyPreviewBar}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#555' }}>
                    Replying to {replyingTo.sender?.username || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>{replyingTo.text || '📎 Media'}</div>
                </div>
                <button onClick={() => setReplyingTo(null)}>✕</button>
              </div>
            )}

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
  chatHeader: {
    padding: '1rem',
    borderBottom: '1px solid #ddd',
    fontWeight: 'bold',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchInput: {
    padding: '0.3rem 0.5rem',
    fontSize: '0.85rem',
    fontWeight: 'normal',
  },
  searchResultsBar: {
    padding: '1rem',
    backgroundColor: '#fffbe6',
    borderBottom: '1px solid #ddd',
    maxHeight: '160px',
    overflowY: 'auto',
  },
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
  messageActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.3rem',
    alignItems: 'center',
  },
  actionBtn: {
    fontSize: '0.7rem',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#888',
    padding: 0,
  },
  smallBtn: {
    fontSize: '0.75rem',
    marginRight: '0.3rem',
    cursor: 'pointer',
  },
  quotedMessage: {
    borderLeft: '3px solid #34B7F1',
    paddingLeft: '0.5rem',
    marginBottom: '0.3rem',
    opacity: 0.85,
  },
  replyPreviewBar: {
    padding: '0.5rem 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #ddd',
    backgroundColor: '#f5f5f5',
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
