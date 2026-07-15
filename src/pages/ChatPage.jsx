// src/pages/ChatPage.jsx
import { useEffect, useState, useRef, useMemo } from 'react';
import axiosInstance from '../api/axiosInstance';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useSocketStore } from '../store/useSocketStore';
import { useThemeStore } from '../store/useThemeStore';
import { useInitSocket } from '../hooks/useInitSocket';
import { playNotificationSound } from '../utils/playNotificationSound';
import { showBrowserNotification } from '../utils/browserNotification';
import toast from 'react-hot-toast';
import { getSocket, disconnectSocket } from '../lib/socket';

function ChatPage() {
  const { user, clearAuth } = useAuthStore();
  const onlineUsers = useSocketStore((state) => state.onlineUsers);
  const typingUsers = useSocketStore((state) => state.typingUsers);
  const { theme, toggleTheme } = useThemeStore();

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
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);

  const handleLogout = () => {
    disconnectSocket();
    clearAuth();
  };

  // Day 7 additions
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  useInitSocket();

  // Fetch all users to start new conversations
  useEffect(() => {
    axiosInstance.get('/users').then((res) => setAllUsers(res.data.users));
  }, []);

  // Fetch existing conversations
  useEffect(() => {
    axiosInstance.get('/conversations').then((res) => {
      setConversations(res.data.conversations);
      setLoadingConversations(false);
    });
  }, []);

  // Single combined socket-listener effect (new_message, messages_seen, message_edited, message_deleted)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (message) => {
      addMessage(message);
      updateLastMessage(message.conversation, message);

      // Only interrupt the user (toast/sound/browser notification) if this message
      // is NOT part of the conversation they're currently looking at.
      const isViewingThisConversation = activeConversation?._id === message.conversation;

      if (isViewingThisConversation) {
        // We're already looking at this chat — mark it seen immediately, live,
        // instead of waiting for the user to leave and reopen the conversation.
        getSocket()?.emit('mark_seen', { conversationId: message.conversation });
      } else {
        toast(`New message from ${message.sender?.username || 'Someone'}`, { icon: '💬' });
        playNotificationSound();
        showBrowserNotification(`${message.sender?.username || 'New message'}`, {
          body: message.text || '📎 Sent an attachment',
        });
      }

      if (!isViewingThisConversation) {
        toast(`New message from ${message.sender?.username || 'Someone'}`, { icon: '💬' });
        playNotificationSound();
        showBrowserNotification(`${message.sender?.username || 'New message'}`, {
          body: message.text || '📎 Sent an attachment',
        });
      }
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

  // Memoized: only recompute when activeConversation or user changes, not on every render
  const otherParticipant = useMemo(() => {
    return activeConversation?.participants?.find((p) => p?._id && p._id !== user.id) || null;
  }, [activeConversation, user.id]);

  const openConversation = async (otherUserId) => {
    const res = await axiosInstance.post('/conversations', { participantId: otherUserId });
    const conversation = res.data.conversation;
    setActiveConversation(conversation);
    setSearchQuery('');
    setSearchResults(null);
    setReplyingTo(null);
    setEditingMessage(null);
    setShowChatOnMobile(true);

    const msgRes = await axiosInstance.get(`/messages/${conversation._id}`);
    setMessages(msgRes.data.messages);

    // Tell the backend we've now seen this conversation's messages
    getSocket()?.emit('mark_seen', { conversationId: conversation._id });
  };

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

    const receiverId = otherParticipant?._id;

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

    const receiverId = otherParticipant?._id;
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

  // Debounced search — waits 400ms after the user stops typing before calling the API
  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    clearTimeout(searchTimeoutRef.current);

    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const res = await axiosInstance.get(`/messages/${activeConversation._id}/search`, {
        params: { q: query },
      });
      setSearchResults(res.data.messages);
    }, 400);
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <div
        className={`w-full md:w-80 border-r border-gray-200 dark:border-gray-700 overflow-y-auto ${
          showChatOnMobile ? 'hidden md:block' : 'block'
        }`}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <strong className="text-gray-900 dark:text-gray-100">{user?.username}</strong>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="text-lg leading-none" title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
            >
              Logout
            </button>
          </div>
        </div>

        <h4 className="px-4 pt-3 pb-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
          All Users
        </h4>

        {loadingConversations ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          allUsers.map((u) => (
            <div
              key={u._id}
              onClick={() => openConversation(u._id)}
              className="p-3 cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span className={onlineUsers.includes(u._id) ? 'text-green-500' : 'text-gray-400'}>
                ●
              </span>{' '}
              <span className="text-gray-800 dark:text-gray-200">{u.username}</span>
            </div>
          ))
        )}
      </div>

      {/* Chat window */}
      <div
        className={`flex-1 flex-col ${showChatOnMobile ? 'flex' : 'hidden md:flex'}`}
      >
        {activeConversation ? (
          <>
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 font-bold">
              <span className="flex items-center">
                <button
                  onClick={() => setShowChatOnMobile(false)}
                  className="md:hidden mr-2 text-lg font-normal"
                >
                  ←
                </button>
                {otherParticipant?.username || 'Unknown user'}
                {typingUsers[otherParticipant?._id] && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2 font-normal">
                    typing...
                  </span>
                )}
              </span>
              <input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={handleSearch}
                className="px-2 py-1 text-sm font-normal rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {searchResults && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border-b border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto">
                <strong>{searchResults.length} result(s)</strong>
                {searchResults.map((m) => (
                  <div key={m._id} className="py-1 text-sm">
                    <strong>{m.sender?.username || 'Unknown'}:</strong> {m.text}
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto bg-[#ECE5DD] dark:bg-gray-800">
              {messages.map((msg, i) => {
                const isMine = msg.sender?._id === user.id;
                return (
                  <div
                    key={msg._id || i}
                    className={`px-3 py-2 rounded-lg max-w-[75%] md:max-w-[60%] ${
                      isMine
                        ? 'self-end bg-green-100 dark:bg-green-900'
                        : 'self-start bg-white dark:bg-gray-700'
                    }`}
                  >
                    {msg.replyTo && (
                      <div className="border-l-[3px] border-sky-400 pl-2 mb-1 opacity-85">
                        <div className="font-bold text-xs">
                          {msg.replyTo?.sender?.username || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {msg.replyTo?.text || '📎 Media'}
                        </div>
                      </div>
                    )}

                    {msg.media?.url && msg.media.type === 'image' && (
                      <img
                        src={msg.media.url}
                        alt="shared"
                        className="max-w-[220px] rounded-md block"
                      />
                    )}
                    {msg.media?.url && msg.media.type === 'video' && (
                      <video
                        src={msg.media.url}
                        controls
                        className="max-w-[220px] rounded-md block"
                      />
                    )}
                    {msg.media?.url && msg.media.type === 'document' && (
                      <a
                        href={msg.media.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-blue-600 dark:text-blue-400"
                      >
                        📄 {msg.media.fileName}
                      </a>
                    )}

                    {editingMessage?._id === msg._id ? (
                      <div>
                        <input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full mb-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          onClick={handleEditSave}
                          className="text-xs mr-2 px-2 py-1 bg-blue-500 text-white rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMessage(null)}
                          className="text-xs px-2 py-1 bg-gray-300 dark:bg-gray-600 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      msg.text && (
                        <div className={msg.media?.url ? 'mt-1' : ''}>
                          {msg.text}
                          {msg.isEdited && (
                            <span className="text-xs text-gray-400 dark:text-gray-500"> (edited)</span>
                          )}
                        </div>
                      )
                    )}

                    <div className="flex gap-2 mt-1 items-center">
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        ↩ Reply
                      </button>
                      {isMine && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMessage(msg);
                              setEditText(msg.text);
                            }}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                          >
                            ✎ Edit
                          </button>
                          <button
                            onClick={() => handleDelete(msg._id)}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            🗑 Delete
                          </button>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
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
              <div className="flex justify-between items-center p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Replying to {replyingTo.sender?.username || 'Unknown'}
                  </div>
                  <div className="text-sm">{replyingTo.text || '📎 Media'}</div>
                </div>
                <button onClick={() => setReplyingTo(null)} className="text-gray-500 dark:text-gray-400">
                  ✕
                </button>
              </div>
            )}

            {selectedFile && (
              <div className="flex items-center p-3 border-t border-gray-200 dark:border-gray-700">
                {filePreview ? (
                  <img src={filePreview} alt="preview" className="h-12 rounded" />
                ) : (
                  <span className="text-sm">📄 {selectedFile.name}</span>
                )}
                <button onClick={clearSelectedFile} className="ml-2 text-gray-500 dark:text-gray-400">
                  ✕
                </button>
              </div>
            )}

            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                id="fileInput"
              />
              <label htmlFor="fileInput" className="cursor-pointer text-xl px-1">
                📎
              </label>

              <input
                value={messageText}
                onChange={handleTyping}
                placeholder="Type a message..."
                className="flex-1 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <button
                type="submit"
                disabled={isSending}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </>
        ) : (
          <div className="p-8 text-gray-400 dark:text-gray-500">
            Select a user to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
