import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerSocketHandlers } from './sockets/handler.js';
import { sessionStore, agentCwd } from './agent/index.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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
