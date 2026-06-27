import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';

interface PermissionModalProps {
  question: string;
  onAllow: () => void;
  onDeny: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({ question, onAllow, onDeny }) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 25 }}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px',
            maxWidth: '420px',
            width: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldAlert size={20} color="var(--warning)" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>Permission Required</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Agent is requesting access</div>
            </div>
          </div>

          <p style={{
            color: 'var(--text-secondary)', fontSize: '14px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
            padding: '12px 16px', borderRadius: 'var(--radius-md)',
            marginBottom: '24px', fontFamily: 'monospace'
          }}>{question}</p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              id="deny-btn"
              onClick={onDeny}
              style={{
                flex: 1, padding: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--error)', cursor: 'pointer',
                fontWeight: 500, fontSize: '14px', transition: 'all 0.2s'
              }}
            >
              Deny
            </button>
            <button
              id="allow-btn"
              onClick={onAllow}
              style={{
                flex: 1, padding: '12px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--success)', cursor: 'pointer',
                fontWeight: 500, fontSize: '14px', transition: 'all 0.2s'
              }}
            >
              Allow
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
