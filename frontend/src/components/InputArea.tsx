import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface InputAreaProps {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  sessionId?: string;
}

export const InputArea: React.FC<InputAreaProps> = ({ input, setInput, onSend, disabled, sessionId }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Agent..."
            disabled={disabled}
            style={{ lineHeight: '1.5' }}
          />
          <button
            id="send-btn"
            className="icon-btn primary"
            onClick={onSend}
            disabled={!input.trim() || disabled}
            style={{ width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0 }}
          >
            <Send size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {sessionId && <span>Session: {sessionId.slice(0, 16)}...</span>}
          <span>Shift + Enter for new line</span>
        </div>
      </div>
    </div>
  );
};
