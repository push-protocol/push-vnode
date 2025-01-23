import { Service } from 'typedi';
import WebSocket from 'ws';
import { WinstonUtil } from "../../utilz/winstonUtil";
import { EnvLoader } from "../../utilz/envLoader";
import { ClientInfo, BlockData, WSMessage, WSClientConnection, SubscriptionFilter, Subscription, SubscribeMessage } from './types';
import { Server } from 'http';

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
                // const allowedOrigins = ['http://localhost:*'];
                
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
            subscriptions: new Map(),
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
        }, 3000000);

        ws.on('message', (data: string) => {
            try {
                const message = JSON.parse(data) as WSMessage;
                this.log.debug(`Received ${message.type} from ${clientId}`);
                this.handleClientMessage(clientId, message);
            } catch (error) {
                this.log.error(`Failed to parse message from client ${clientId}:`, error);
                this.sendToClient(clientId, {
                    type: 'ERROR',
                    data: { message: 'Invalid message format' },
                    timestamp: Date.now(),
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
        }, 3000000);

        ws.on('close', () => clearInterval(pingInterval));

        // Send welcome message
        this.sendToClient(clientId, {
            type: 'WELCOME',
            data: { clientId },
            timestamp: Date.now(),
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
                    const handshakeData = message.data as ClientInfo & { clientId?: string };
                    
                    // Strict validation of clientId
                    if (!handshakeData.clientId || handshakeData.clientId !== clientId) {
                        this.log.warn(`Client sent invalid clientId in handshake. Expected: ${clientId}, Received: ${handshakeData.clientId}`);
                        this.sendToClient(clientId, {
                            type: 'HANDSHAKE_ACK',
                            data: { 
                                success: false, 
                                error: 'Invalid clientId',
                                expectedClientId: clientId,
                                receivedClientId: handshakeData.clientId 
                            },
                            timestamp: Date.now(),
                        });
                        client.ws.close(1008, 'Invalid handshake clientId');
                        return;
                    }

                    // Only proceed if clientId matches
                    client.clientInfo = handshakeData;
                    client.reconnectAttempts = 0;
                    this.log.info(`Client ${clientId} handshake completed successfully`);
                    
                    this.sendToClient(clientId, {
                        type: 'HANDSHAKE_ACK',
                        data: { success: true, clientId },
                        timestamp: Date.now(),
                    });
                }
                break;

            case 'SUBSCRIBE':
                if (typeof message.data === 'object') {
                    const subscribeMsg = message.data as SubscribeMessage;
                    
                    // Check for existing similar subscriptions
                    const hasSimilarSubscription = Array.from(client.subscriptions.values()).some(
                        existing => this.areFiltersEqual(existing.filters, subscribeMsg.filters)
                    );

                    if (hasSimilarSubscription) {
                        this.sendToClient(clientId, {
                            type: 'SUBSCRIBE_ERROR',
                            data: { message: 'Similar subscription already exists' },
                            timestamp: Date.now(),
                        });
                        return;
                    }

                    // Rate limiting: Check last subscription time
                    const now = Date.now();
                    if (!client.lastSubscribeTime) {
                        client.lastSubscribeTime = now;
                    } else if (now - client.lastSubscribeTime < 1000) { // 1 second minimum between subscriptions
                        this.sendToClient(clientId, {
                            type: 'SUBSCRIBE_ERROR',
                            data: { message: 'Please wait before creating another subscription' },
                            timestamp: now,
                        });
                        return;
                    }
                    client.lastSubscribeTime = now;

                    // Validate subscription filters
                    if (!this.areValidFilters(subscribeMsg.filters)) {
                        this.sendToClient(clientId, {
                            type: 'SUBSCRIBE_ERROR',
                            data: { message: 'Invalid subscription filters' },
                            timestamp: Date.now(),
                        });
                        return;
                    }

                    const subscriptionId = this.generateSubscriptionId();
                    const subscription: Subscription = {
                        id: subscriptionId,
                        filters: subscribeMsg.filters
                    };

                    client.subscriptions.set(subscriptionId, subscription);
                    
                    this.log.debug(`Client ${clientId} created subscription ${subscriptionId} with filters:`, 
                        JSON.stringify(subscribeMsg.filters));
                    
                    this.sendToClient(clientId, {
                        type: 'SUBSCRIBE_ACK',
                        data: { 
                            subscriptionId,
                            filters: subscribeMsg.filters,
                            success: true 
                        },
                        timestamp: Date.now(),
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
                    });
                }
                break;

            case 'PING':
                this.sendToClient(clientId, {
                    type: 'PONG',
                    timestamp: Date.now(),
                });
                break;

            default:
                this.log.warn(`Unknown message type received from client ${clientId}: ${message.type}`);
        }
    }

    private areValidFilters(filters: SubscriptionFilter[]): boolean {
        if (!Array.isArray(filters) || filters.length === 0) return false;
        
        return filters.every(filter => {
            switch (filter.type) {
                case 'NEW_BLOCK':
                    return true;
                case 'CATEGORY':
                    return typeof filter.value === 'string' && filter.value.length > 0;
                case 'SELF':
                    return true;
                case 'SENDERS':
                case 'RECEIVERS':
                    return typeof filter.value === 'string' || Array.isArray(filter.value);
                default:
                    return false;
            }
        });
    }

    private generateSubscriptionId(): string {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
            this.log.debug(`Sent ${message.type} to client ${clientId}`);
        } catch (error) {
            this.log.error(`Failed to send ${message.type} to client ${clientId}:`, error);
        }
    }

    public broadcastBlockUpdate(blockData: BlockData) {
        this.clients.forEach((client, clientId) => {
            if (client.ws.readyState !== WebSocket.OPEN) return;
            // Check each subscription
            client.subscriptions.forEach((subscription, subId) => {
                // Send notification for each filter, including match status
                subscription.filters.forEach(filter => {
                    try {
                        // Check if filter matches
                        let matches = false;
                        if (filter.type === 'NEW_BLOCK') {
                            matches = true;
                        } else if (filter.type === 'CATEGORY' && this.matchesCategory(blockData, filter)) {
                            matches = true;
                        } else if (filter.type === 'SELF' && this.matchesSelf(blockData, filter, clientId)) {
                            matches = true;
                        } else if (filter.type === 'SENDERS' && this.matchesSenderAddress(blockData, filter)) {
                            matches = true;
                        } else if (filter.type === 'RECEIVERS' && this.matchesReceiversAddress(blockData, filter)) {
                            matches = true;
                        }

                        if (matches) {
                            const updateMessage: WSMessage = {
                                type: filter.type,
                                data: {
                                    block: blockData,
                                    subscriptionId: subId,
                                    matchedFilter: filter,
                                    matches
                                },
                                timestamp: Date.now(),
                            };

                            client.ws.send(JSON.stringify(updateMessage));
                            this.log.debug(`Sent ${filter.type} update to client ${clientId} (subscription: ${subId}, matches: ${matches})`);
                        }
                    } catch (error) {
                        this.log.error(`Failed to process ${filter.type} for client ${clientId}:`, error);
                    }
                });
            });
        });
    }

    private matchesCategory(blockData: any, filter: SubscriptionFilter): boolean {
        // Check if blockData and required fields exist
        if (!blockData?.data_as_json?.txobjList?.[0]?.tx?.category) {
            return false;
        }

        // Get the category from the first transaction
        const txCategory = blockData.data_as_json.txobjList[0].tx.category;
        
        // Compare with filter value
        return txCategory === filter.value;
    }

    private matchesSelf(blockData: any, filter: SubscriptionFilter, clientId: string): boolean {
        const client = this.clients.get(clientId);
        if (!client?.clientInfo?.producerAddress) return false;
        
        const address = client.clientInfo.producerAddress.toLowerCase();

        // For debugging, only log relevant info
        this.log.debug('Matching self for client:', {
            clientId,
            producerAddress: address
        });

        // Get sender and recipients from the first transaction
        const tx = blockData?.data_as_json?.txobjList?.[0]?.tx;
        if (!tx) return false;

        const sender = tx.sender?.toLowerCase();
        const recipients = tx.recipientsList?.map((r: string) => r.toLowerCase()) || [];

        // Check if address matches sender or is in recipients list
        return sender === address || recipients.includes(address);
    }

    private matchesSenderAddress(blockData: any, filter: SubscriptionFilter): boolean {
        if (!filter.value) return false;
        const addresses = (Array.isArray(filter.value) ? filter.value : [filter.value])
            .map(addr => addr.toLowerCase());
        
        // Get sender from the first transaction
        const sender = blockData?.data_as_json?.txobjList?.[0]?.tx?.sender?.toLowerCase();
        if (!sender) return false;

        // Check if sender matches any of the filter addresses
        return addresses.includes(sender);
    }

    private matchesReceiversAddress(blockData: any, filter: SubscriptionFilter): boolean {
        if (!filter.value) return false;
        const addresses = (Array.isArray(filter.value) ? filter.value : [filter.value])
            .map(addr => addr.toLowerCase());
        
        // Get recipients list from the first transaction
        const recipients = blockData?.data_as_json?.txobjList?.[0]?.tx?.recipientsList?.map(
            (r: string) => r.toLowerCase()
        ) || [];

        // Check if any recipient matches any of the filter addresses
        return addresses.some(address => recipients.includes(address));
    }

    private matchWildcard(str: string, pattern: string): boolean {
        const regexPattern = pattern.replace(/\*/g, '.*');
        return new RegExp(`^${regexPattern}$`).test(str);
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

    private areFiltersEqual(filters1: SubscriptionFilter[], filters2: SubscriptionFilter[]): boolean {
        if (filters1.length !== filters2.length) return false;
        
        return filters1.every((filter1, index) => {
            const filter2 = filters2[index];
            return filter1.type === filter2.type && 
                   JSON.stringify(filter1.value) === JSON.stringify(filter2.value);
        });
    }
}