// src/components/MessageBubble.jsx
import { memo } from 'react';

function MessageBubble({ msg, isMine, onReply, onEdit, onDelete }) {
  return (
    <div
      className={`px-3 py-2 rounded-lg max-w-[60%] ${
        isMine ? 'self-end bg-green-100 dark:bg-green-900' : 'self-start bg-white dark:bg-gray-700'
      }`}
    >
      {/* ...same bubble content as before... */}
    </div>
  );
}

// Only re-render this specific bubble if ITS OWN props changed — not on every parent re-render
export default memo(MessageBubble); 