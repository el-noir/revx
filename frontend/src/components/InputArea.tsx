import React, { useRef, useEffect, useState } from 'react';
import { Send, Paperclip, X } from 'lucide-react';

interface InputAreaProps {
  input: string;
  setInput: (v: string) => void;
  onSend: (attachedFilePath?: string) => void;
  disabled: boolean;
  sessionId?: string;
}

export const InputArea: React.FC<InputAreaProps> = ({ input, setInput, onSend, disabled, sessionId }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [attachedFile, setAttachedFile] = useState<{name: string, path: string} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!input.trim() && !attachedFile) return;
    onSend(attachedFile?.path);
    setAttachedFile(null);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:4000/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.path) {
        setAttachedFile({ name: file.name, path: data.path });
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ 
        padding: '12px 20px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '8px',
        position: 'relative',
        backgroundColor: isDragging ? 'var(--bg-hover)' : 'transparent',
        transition: 'background-color 0.2s',
        borderRadius: '12px 12px 0 0'
      }}
    >
      {isDragging && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
          border: '2px dashed var(--primary)',
          borderRadius: '12px 12px 0 0',
          zIndex: 10,
          pointerEvents: 'none'
        }}>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Drop file to upload</span>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {attachedFile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-hover)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            width: 'max-content',
            fontSize: '13px'
          }}>
            <Paperclip size={14} />
            <span style={{ fontWeight: 500 }}>{attachedFile.name}</span>
            <button 
              className="icon-btn" 
              onClick={() => setAttachedFile(null)}
              style={{ width: '20px', height: '20px' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="chat-input-wrapper" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          
          <button
            className="icon-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            title="Attach file"
            style={{ width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0, marginBottom: '2px' }}
          >
            <Paperclip size={18} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            style={{ display: 'none' }} 
          />

          <textarea
            ref={textareaRef}
            className="chat-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isUploading ? "Uploading..." : "Message Agent..."}
            disabled={disabled || isUploading}
            style={{ lineHeight: '1.5', flex: 1 }}
          />
          
          <button
            id="send-btn"
            className="icon-btn primary"
            onClick={handleSend}
            disabled={(!input.trim() && !attachedFile) || disabled || isUploading}
            style={{ width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0, marginBottom: '2px' }}
          >
            <Send size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {sessionId && <span>Session: {sessionId.slice(0, 16)}...</span>}
          <span>Shift + Enter for new line</span>
        </div>
      </div>
    </div>
  );
};
