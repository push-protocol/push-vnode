// src/services/WebSockets/WebSocketServer.ts
import { Service } from 'typedi';
import WebSocket from 'ws';
import { WinstonUtil } from "../../utilz/winstonUtil";
import { EnvLoader } from "../../utilz/envLoader";
import { ClientInfo, BlockData, WSMessage } from './types';
import { Server } from 'http';

interface WSClientConnection {
    ws: WebSocket;
    subscriptions: Set<string>;
    connectedAt: number;
    clientInfo?: ClientInfo;
    reconnectAttempts?: number;
}

@Service()
export class WebSocketServer {
    private wss: WebSocket.Server;
    private clients = new Map<string, WSClientConnection>();
    private readonly log = WinstonUtil.newLog("WebSocketServer");

    async postConstruct(server: Server) {
        try {
            await this.initialize(server);
        } catch (error) {
            this.log.error('Failed to initialize WebSocket server:', error);
            throw error;
        }
    }

    private async initialize(server: Server) {        
        this.wss = new WebSocket.Server({ 
            server, // server is the http server
            maxPayload: EnvLoader.getPropertyAsNumber('WS_MAX_PAYLOAD', 5 * 1024 * 1024),
            // Add CORS headers for browser clients
            verifyClient: (info, cb) => {
                const origin = info.origin || info.req.headers.origin;
                // Allow Postman and localhost for testing
                const allowedOrigins = ['http://localhost:3000', 'https://yourdomain.com'];
                
                // During testing, accept all connections
                cb(true);
                
                // In production, use this:
                // if (!origin || allowedOrigins.includes(origin)) {
                //     cb(true);
                // } else {
                //     cb(false, 403, 'Forbidden');
                // }
            }
        });

        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = this.generateClientId();
            this.handleClientConnection(clientId, ws);
        });

        // Wait for server to be listening and get address
        let addr = server.address();
        
        if (!addr) {
            this.log.info('Waiting for HTTP server to start listening...');
            await new Promise<void>(resolve => server.once('listening', resolve));
            addr = server.address();
        }

        if (!addr) {
            this.log.warn('Could not determine server address');
            return;
        }

        const port = typeof addr === 'string' ? addr : addr?.port;
        const host = typeof addr === 'string' ? addr : addr?.address === '::' ? 'localhost' : addr?.address;
        this.log.info(`WebSocket server listening at ws://${host}:${port}`);
    }

    private handleClientConnection(clientId: string, ws: WebSocket) {
        this.log.info(`New client connected: ${clientId}`);
        
        // Initialize client connection
        const client: WSClientConnection = {
            ws,
            subscriptions: new Set(),
            connectedAt: Date.now(),
            reconnectAttempts: 0
        };
        this.clients.set(clientId, client);

        // Set connection timeout for handshake
        const handshakeTimeout = setTimeout(() => {
            if (!client.clientInfo) {
                this.log.warn(`Client ${clientId} failed to complete handshake within timeout`);
                ws.close(1008, 'Handshake timeout');
            }
        }, 5000);

        ws.on('message', (data: string) => {
            try {
                const message = JSON.parse(data) as WSMessage;
                this.log.debug(`Received message from ${clientId}:`, message);
                this.handleClientMessage(clientId, message);
            } catch (error) {
                this.log.error(`Failed to parse message from client ${clientId}:`, error);
                this.sendToClient(clientId, {
                    type: 'ERROR',
                    data: { message: 'Invalid message format' },
                    timestamp: Date.now(),
                    nodeId: '',
                    nodeType: '',
                    events: []
                });
            }
        });

        ws.on('close', (code: number, reason: string) => {
            clearTimeout(handshakeTimeout);
            this.handleClientDisconnection(clientId, code, reason);
        });

        ws.on('error', (error) => {
            this.log.error(`Client ${clientId} error:`, error);
            this.handleClientDisconnection(clientId, 1006, 'Connection error');
        });

        // Setup heartbeat
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        }, 30000);

        ws.on('close', () => clearInterval(pingInterval));

        // Send welcome message
        this.sendToClient(clientId, {
            type: 'WELCOME',
            data: { clientId },
            timestamp: Date.now(),
            nodeId: '',
            nodeType: '',
            events: []
        });
    }

    private handleClientMessage(clientId: string, message: WSMessage) {
        const client = this.clients.get(clientId);
        if (!client) {
            this.log.warn(`Message received from unknown client ${clientId}`);
            return;
        }

        switch (message.type) {
            case 'HANDSHAKE':
                if (typeof message.data === 'object') {
                    client.clientInfo = message.data as ClientInfo;
                    client.reconnectAttempts = 0;
                    this.log.info(`Client ${clientId} handshake completed:`, client.clientInfo);
                    
                    this.sendToClient(clientId, {
                        type: 'HANDSHAKE_ACK',
                        data: { success: true, clientId },
                        timestamp: Date.now(),
                        nodeId: '',
                        nodeType: '',
                        events: []
                    });
                }
                break;

            case 'SUBSCRIBE':
                if (typeof message.data === 'string') {
                    client.subscriptions.add(message.data);
                    this.log.debug(`Client ${clientId} subscribed to ${message.data}`);
                    
                    this.sendToClient(clientId, {
                        type: 'SUBSCRIBE_ACK',
                        data: { topic: message.data, success: true },
                        timestamp: Date.now(),
                        nodeId: '',
                        nodeType: '',
                        events: []
                    });
                }
                break;

            case 'UNSUBSCRIBE':
                if (typeof message.data === 'string') {
                    client.subscriptions.delete(message.data);
                    this.log.debug(`Client ${clientId} unsubscribed from ${message.data}`);
                    
                    this.sendToClient(clientId, {
                        type: 'UNSUBSCRIBE_ACK',
                        data: { topic: message.data, success: true },
                        timestamp: Date.now(),
                        nodeId: '',
                        nodeType: '',
                        events: []
                    });
                }
                break;

            case 'PING':
                this.sendToClient(clientId, {
                    type: 'PONG',
                    timestamp: Date.now(),
                    nodeId: '',
                    nodeType: '',
                    events: []
                });
                break;

            default:
                this.log.warn(`Unknown message type received from client ${clientId}: ${message.type}`);
        }
    }

    private handleClientDisconnection(clientId: string, code: number, reason: string) {
        const client = this.clients.get(clientId);
        if (!client) return;

        this.log.info(`Client disconnected: ${clientId}, code: ${code}, reason: ${reason}`);
        
        // Keep client info for potential reconnection
        if (code === 1001 || code === 1006) { // Normal closure or abnormal closure
            setTimeout(() => {
                if (this.clients.has(clientId)) {
                    this.clients.delete(clientId);
                }
            }, 5 * 60 * 1000); // Keep client info for 5 minutes
        } else {
            this.clients.delete(clientId);
        }
    }

    private sendToClient(clientId: string, message: WSMessage) {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) return;

        try {
            client.ws.send(JSON.stringify(message));
            this.log.debug(`Sent message to client ${clientId}:`, message);
        } catch (error) {
            this.log.error(`Failed to send message to client ${clientId}:`, error);
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