import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerSocketHandlers } from './sockets/handler.js';
import { sessionStore, agentCwd } from './agent/index.js';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_ROOT = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(BACKEND_ROOT, 'files');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log(`[Upload] Created uploads directory: ${UPLOADS_DIR}`);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
         cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
})

const upload = multer({storage});

app.post('/api/upload', (req: any, res: any) => {
    // Run multer manually so we can catch its errors and return JSON
    upload.single('file')(req, res, (err: any) => {
        if (err) {
            console.error('[Upload] Multer error:', err);
            return res.status(500).json({ error: err.message || 'Upload failed' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        console.log(`[Upload] Saved file: ${req.file.path}`);
        res.json({ path: req.file.path });
})
});

app.get('/api/sessions', async (_req: any, res: any) => {
    try {
  
        const sessions = await sessionStore.listAllSessions();
        res.json(sessions);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/sessions/:id', async (req: any, res: any) => {
    try {
        // Delete across all project keys matching this session_id
        await sessionStore.deleteBySessionId(req.params.id);
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

io.on('connection', (socket) => {
    console.log(`[Socket Connected] ${socket.id}`);
    registerSocketHandlers(io, socket);

    socket.on('disconnect', () => {
        console.log(`[Socket Disconnected] ${socket.id}`);
    });
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
    console.log(`=== Revcon Backend Server Started on port ${PORT} ===`);
});
