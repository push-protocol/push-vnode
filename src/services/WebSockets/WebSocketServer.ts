// src/services/WebSockets/WebSocketServer.ts
import { Service } from 'typedi';
import WebSocket from 'ws';
import { WinstonUtil } from "../../utilz/winstonUtil";
import { EnvLoader } from "../../utilz/envLoader";
import { ClientInfo, BlockData, WSMessage } from './types';

interface WSClientConnection {
    ws: WebSocket;
    subscriptions: Set<string>;
    connectedAt: number;
}

@Service()
export class WebSocketServer {
    private wss: WebSocket.Server;
    private clients = new Map<string, WSClientConnection>();
    private readonly log = WinstonUtil.newLog("WebSocketServer");

    async postConstruct() {
        try {
            await this.initialize();
            this.log.info('WebSocket server initialized');
        } catch (error) {
            this.log.error('Failed to initialize WebSocket server:', error);
            throw error;
        }
    }

    private async initialize() {
        const port = EnvLoader.getPropertyAsNumber('WS_PORT', 8080);
        
        this.wss = new WebSocket.Server({ 
            port,
            maxPayload: EnvLoader.getPropertyAsNumber('WS_MAX_PAYLOAD', 5 * 1024 * 1024)
        });

        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = this.generateClientId();
            this.handleClientConnection(clientId, ws);
        });

        this.log.info(`WebSocket server listening on port ${port}`);
    }

    private handleClientConnection(clientId: string, ws: WebSocket) {
        this.log.info(`New client connected: ${clientId}`);
        this.clients.set(clientId, {
            ws,
            subscriptions: new Set(),
            connectedAt: Date.now()
        });

        ws.on('message', (data: string) => {
            try {
                const message = JSON.parse(data) as WSMessage;
                this.handleClientMessage(clientId, message);
            } catch (error) {
                this.log.error(`Failed to parse message from client ${clientId}:`, error);
            }
        });

        ws.on('close', () => {
            this.log.info(`Client disconnected: ${clientId}`);
            this.clients.delete(clientId);
        });

        ws.on('error', (error) => {
            this.log.error(`Client ${clientId} error:`, error);
            this.clients.delete(clientId);
        });

        // Setup heartbeat
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        }, 30000);

        ws.on('close', () => clearInterval(pingInterval));
    }

    private handleClientMessage(clientId: string, message: WSMessage) {
        switch (message.type) {
            case 'SUBSCRIBE':
                const client = this.clients.get(clientId);
                if (client && typeof message.data === 'string') {
                    client.subscriptions.add(message.data);
                    this.log.debug(`Client ${clientId} subscribed to ${message.data}`);
                }
                break;
        }
    }

    public broadcastBlockUpdate(blockData: BlockData) {
        const message: WSMessage = {
            type: 'BLOCK_STORED',
            data: blockData,
            timestamp: Date.now(),
            nodeId: blockData.nodeId,
            nodeType: blockData.nodeType,
            events: []
        };

        this.clients.forEach((client, clientId) => {
            if (client.ws.readyState === WebSocket.OPEN && 
                client.subscriptions.has('BLOCK_STORED')) {
                try {
                    client.ws.send(JSON.stringify(message));
                    this.log.debug(`Sent block update to client ${clientId}`);
                } catch (error) {
                    this.log.error(`Failed to send to client ${clientId}:`, error);
                }
            }
        });
    }

    private generateClientId(): string {
        return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    async shutdown() {
        for (const [clientId, client] of this.clients) {
            this.log.info(`Closing connection to client ${clientId}`);
            client.ws.close();
        }

        if (this.wss) {
            await new Promise<void>((resolve) => this.wss.close(() => resolve()));
        }
    }
}