import { Service } from 'typedi';
import WebSocket from 'ws';
import { WinstonUtil } from "../../utilz/winstonUtil";
import { EnvLoader } from "../../utilz/envLoader";
import { Server } from 'http';
import {
    WSMessage,
    WSClientConnection,
    SubscriptionFilter,
    Subscription,
    FilterBlockResponse,
    ClientInfo,
    FilteredTxData,
    BlockUpdateMessage
} from './types';

const CONSTANTS = {
    HANDSHAKE_TIMEOUT: 30000, // 30 seconds
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    RECONNECT_WINDOW: 60 * 1000, // 1 minute
    SUBSCRIPTION_RATE_LIMIT: 1000, // 1 second
} as const;

/**
 * WebSocket server implementation for handling real-time client connections and subscriptions.
 * Manages client connections, authentication, subscriptions, and real-time block updates.
 * 
 * Features:
 * - Client handshake and authentication
 * - Subscription management with filtering
 * - Real-time block updates
 * - Connection health monitoring
 * - Rate limiting for subscriptions
 */
@Service()
export class WebSocketServer {
    private wss: WebSocket.Server;
    private clients = new Map<string, WSClientConnection>();
    private readonly log = WinstonUtil.newLog("WebSocketServer");

    /**
     * Initializes the WebSocket server after class construction.
     * @param server - HTTP server instance to attach the WebSocket server to
     */
    async postConstruct(server: Server) {
        try {
            await this.initialize(server);
        } catch (error) {
            this.log.error('Failed to initialize WebSocket server: %o', error);
            throw error;
        }
    }

    private async initialize(server: Server) {        
        this.wss = new WebSocket.Server({ 
            server,
            maxPayload: EnvLoader.getPropertyAsNumber('WS_MAX_PAYLOAD', 5 * 1024 * 1024), // 5MB
            verifyClient: (info, cb) => {
                cb(true);
            }
        });

        this.setupServerListeners(server);
    }

    private async setupServerListeners(server: Server) {
        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = this.generateClientId();
            this.handleClientConnection(clientId, ws);
        });

        await this.waitForServerToListen(server);
    }

    private async waitForServerToListen(server: Server) {
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
        const client = this.initializeClient(clientId, ws);
        const cleanup = this.setupClientTimeouts(clientId, client);
        this.setupClientListeners(clientId, ws, cleanup);
        this.sendWelcomeMessage(clientId);
    }

    /**
     * Initializes a new client connection with basic state.
     * Sets up connection tracking and logging.
     * 
     * @param clientId - Unique identifier for the client
     * @param ws - WebSocket connection instance
     * @returns Initialized client connection object
     */
    private initializeClient(clientId: string, ws: WebSocket): WSClientConnection {
        const client: WSClientConnection = {
            ws,
            subscriptions: new Map(),
            connectedAt: Date.now(),
            reconnectAttempts: 0
        };
        this.clients.set(clientId, client);
        this.log.info(`New client connected: ${clientId}`);
        return client;
    }

    /**
     * Sets up client timeouts for handshake and heartbeat.
     * - Handshake must complete within HANDSHAKE_TIMEOUT
     * - Regular ping messages sent at HEARTBEAT_INTERVAL
     * 
     * @param clientId - Client identifier
     * @param client - Client connection object
     * @returns Cleanup handlers for timeouts
     */
    private setupClientTimeouts(clientId: string, client: WSClientConnection) {
        const handshakeTimeout = setTimeout(() => {
            if (!client.clientInfo) {
                this.log.warn(`Client ${clientId} failed to complete handshake within timeout`);
                client.ws.close(1008, 'Handshake timeout');
            }
        }, CONSTANTS.HANDSHAKE_TIMEOUT);

        const pingInterval = setInterval(() => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.ping();
            }
        }, CONSTANTS.HEARTBEAT_INTERVAL);

        return { handshakeTimeout, pingInterval };
    }

    private setupClientListeners(clientId: string, ws: WebSocket, cleanup: { handshakeTimeout: NodeJS.Timeout, pingInterval: NodeJS.Timeout }) {
        ws.on('message', (data: string) => {
            try {
                const message = JSON.parse(data) as WSMessage;
                this.log.debug(`Received ${message.type} from ${clientId}`);
                this.handleClientMessage(clientId, message);
            } catch (error) {
                this.log.error(`Failed to parse message from client ${clientId}: %o`, error);
                this.sendErrorMessage(clientId);
            }
        });

        ws.on('close', (code: number, reason: string) => {
            clearTimeout(cleanup.handshakeTimeout);
            clearInterval(cleanup.pingInterval);
            this.handleClientDisconnection(clientId, code, reason);
        });

        ws.on('error', (error) => {
            this.log.error(`Client ${clientId} error: %o`, error);
            this.handleClientDisconnection(clientId, 1006, 'Connection error');
        });
    }

    /**
     * Processes incoming client messages based on type.
     * Handles: HANDSHAKE, SUBSCRIBE, UNSUBSCRIBE, PING
     * 
     * @param clientId - Client identifier
     * @param message - Parsed WebSocket message
     */
    private handleClientMessage(clientId: string, message: WSMessage) {
        const client = this.clients.get(clientId);
        if (!client) {
            this.log.warn(`Message received from unknown client ${clientId}`);
            return;
        }

        switch (message.type) {
            case 'HANDSHAKE':
                this.handleHandshake(clientId, client, message);
                break;
            case 'SUBSCRIBE':
                if (!client.clientInfo) {
                    this.sendSubscribeError(clientId, 'Handshake required before subscribing');
                    return;
                }
                this.handleSubscribe(clientId, client, message);
                break;
            case 'UNSUBSCRIBE':
                this.handleUnsubscribe(clientId, client, message);
                break;
            case 'PING':
                this.sendPongMessage(clientId);
                break;
            default:
                this.log.warn(`Unknown message type received from client ${clientId}: ${message.type}`);
        }
    }

    /**
     * Processes client handshake requests.
     * Validates handshake data and clientId match.
     * 
     * @param clientId - Client identifier
     * @param client - Client connection object
     * @param message - Handshake message
     */
    private handleHandshake(clientId: string, client: WSClientConnection, message: WSMessage) {
        if (message.type !== 'HANDSHAKE' || !this.isValidHandshakeData(message.data)) {
            this.sendHandshakeError(clientId, 'Invalid handshake data');
            return;
        }

        if (message.data.clientId !== clientId) {
            this.sendHandshakeError(clientId, 'Invalid clientId');
            client.ws.close(1008, 'Invalid handshake clientId');
            return;
        }

        client.clientInfo = message.data;
        client.reconnectAttempts = 0;
        this.log.info(`Client ${clientId} handshake completed successfully`);
        
        this.sendToClient(clientId, {
            type: 'HANDSHAKE_ACK',
            data: { success: true },
            timestamp: Date.now()
        });
    }

    /**
     * Processes subscription requests from clients.
     * Validates filters and manages subscription creation.
     * Handles special case for wildcard subscriptions.
     * Implements rate limiting for subscription requests.
     * 
     * @param clientId - Client identifier
     * @param client - Client connection object
     * @param message - Subscription request message
     */
    private handleSubscribe(clientId: string, client: WSClientConnection, message: WSMessage) {
        if (message.type !== 'SUBSCRIBE') {
            this.sendSubscribeError(clientId, 'Invalid subscription message');
            return;
        }

        if (Array.isArray(message.filters)) {
            if (message.filters.length === 1 && 
                'type' in message.filters[0] && 
                message.filters[0].type === 'WILDCARD' && 
                message.filters[0].value[0] === '*') {
                const subscriptionId = this.createSubscription(client, [{ type: 'WILDCARD', value: ['*'] }]);
                this.sendSubscribeAck(clientId, subscriptionId, [{ type: 'WILDCARD', value: ['*'] }]);
                return;
            } else if (message.filters.some(filter => filter.type === 'WILDCARD' && filter.value[0] === '*')) {
                this.sendSubscribeError(clientId, 'Wildcard must be the only filter');
                return;
            }
        }

        if (this.hasSimilarSubscription(client, message.filters)) {
            this.sendSubscribeError(clientId, 'Similar subscription already exists');
            return;
        }

        if (!this.checkSubscriptionRateLimit(client)) {
            this.sendSubscribeError(clientId, 'Please wait before creating another subscription');
            return;
        }

        if (!this.areValidFilters(message.filters)) {
            this.sendSubscribeError(clientId, 'Invalid subscription filters');
            return;
        }

        const subscriptionId = this.createSubscription(client, message.filters);
        this.sendSubscribeAck(clientId, subscriptionId, message.filters);
    }

    private handleUnsubscribe(clientId: string, client: WSClientConnection, message: WSMessage) {
        if (message.type !== 'UNSUBSCRIBE' || !message.data?.subscriptionId) {
            this.log.warn(`Invalid unsubscribe message from client ${clientId}`);
            return;
        }

        client.subscriptions.delete(message.data.subscriptionId);
        this.log.debug(`Client ${clientId} unsubscribed from ${message.data.subscriptionId}`);
        
        this.sendToClient(clientId, {
            type: 'UNSUBSCRIBE_ACK',
            data: { success: true, subscriptionId: message.data.subscriptionId },
            timestamp: Date.now()
        });
    }

    private isValidHandshakeData(data: any): data is ClientInfo {
        return typeof data === 'object' 
            && 'clientId' in data 
            && typeof data.clientId === 'string'
    }

    private hasSimilarSubscription(client: WSClientConnection, filters: SubscriptionFilter[]): boolean {
        return Array.from(client.subscriptions.values()).some(
            existing => this.areFiltersEqual(existing.filters, filters)
        );
    }

    private checkSubscriptionRateLimit(client: WSClientConnection): boolean {
        const now = Date.now();
        if (!client.lastSubscribeTime) {
            client.lastSubscribeTime = now;
            return true;
        }
        
        if (now - client.lastSubscribeTime < CONSTANTS.SUBSCRIPTION_RATE_LIMIT) {
            return false;
        }
        
        client.lastSubscribeTime = now;
        return true;
    }

    private createSubscription(client: WSClientConnection, filters: SubscriptionFilter[]): string {
        const subscriptionId = this.generateSubscriptionId();
        const subscription: Subscription = {
            id: subscriptionId,
            filters
        };
        client.subscriptions.set(subscriptionId, subscription);
        return subscriptionId;
    }

    /**
     * Broadcasts block updates to all connected clients based on their subscription filters.
     * @param blockData - Block data containing transactions to be filtered and broadcast
     */
    public broadcastBlockUpdate(blockData: FilterBlockResponse) {
        this.clients.forEach((client, clientId) => {
            if (client.ws.readyState !== WebSocket.OPEN) return;
            
            client.subscriptions.forEach((subscription, subId) => {
                const matchingTxs = this.getMatchingTransactions(blockData, subscription.filters);
                if (matchingTxs.length > 0) {
                    this.sendBlockUpdate(client, subId, blockData.blockHash, matchingTxs, subscription.filters);
                }
            });
        });
    }

    private getMatchingTransactions(blockData: FilterBlockResponse, filters: SubscriptionFilter[]): FilteredTxData[] {
        return blockData.txs.filter(tx => {
            return filters.some(filter => this.matchesFilter(tx, filter, blockData.blockHash));
        });
    }

    /**
     * Filters transactions based on subscription criteria.
     * Supports multiple filter types: CATEGORY, FROM, RECIPIENTS, WILDCARD
     * 
     * @param tx - Transaction data to check
     * @param filter - Subscription filter to apply
     * @param blockHash - Hash of the block containing the transaction
     * @returns boolean indicating if transaction matches filter
     */
    private matchesFilter(tx: FilteredTxData, filter: SubscriptionFilter, blockHash: string): boolean {
        try {
            if (filter.type === 'WILDCARD' && filter.value[0] === '*') {
                return true;
            }

            const blockWithTx: FilterBlockResponse = {
                blockHash,
                txs: [tx]
            };

            switch (filter.type) {
                case 'CATEGORY':
                    return this.matchesCategory(blockWithTx, filter);
                case 'FROM':
                    return this.matchesSenderAddress(blockWithTx, filter);
                case 'RECIPIENTS':
                    return this.matchesReceiversAddress(blockWithTx, filter);
                default:
                    return false;
            }
        } catch (error) {
            this.log.error(`Failed to process ${filter.type} filter: %o`, error);
            return false;
        }
    }

    /**
     * Sends block update to client for matching transactions.
     * Only includes filters that matched the transactions.
     * 
     * @param client - Client connection object
     * @param subscriptionId - Subscription identifier
     * @param blockHash - Hash of the block
     * @param matchingTxs - Transactions matching subscription filters
     * @param filters - Original subscription filters
     */
    private sendBlockUpdate(
        client: WSClientConnection, 
        subscriptionId: string, 
        blockHash: string, 
        matchingTxs: FilteredTxData[], 
        filters: SubscriptionFilter[]
    ) {
        // Get only the filters that matched
        const matchedFilters = filters.filter(filter => 
            matchingTxs.some(tx => this.matchesFilter(tx, filter, blockHash))
        );

        const updateMessage: BlockUpdateMessage = {
            type: 'BLOCK',
            data: {
                block: {
                    blockHash,
                    txs: matchingTxs
                },
                subscriptionId,
                matchedFilter: matchedFilters  // Send only matched filters
            },
            timestamp: Date.now()
        };

        client.ws.send(JSON.stringify(updateMessage));
    }

    private matchesCategory(blockData: FilterBlockResponse, filter: SubscriptionFilter): boolean {
        return blockData.txs.some(tx => 
            tx.category && filter.value.includes(tx.category)
        );
    }

    private matchesSenderAddress(blockData: FilterBlockResponse, filter: SubscriptionFilter): boolean {
        const addresses = filter.value.map(addr => addr.toLowerCase());
        return blockData.txs.some(tx => 
            tx.from && addresses.includes(tx.from.toLowerCase())
        );
    }

    private matchesReceiversAddress(blockData: FilterBlockResponse, filter: SubscriptionFilter): boolean {
        const addresses = filter.value.map(addr => addr.toLowerCase());
        return blockData.txs.some(tx => 
            tx.recipients?.some(recipient => 
                addresses.includes(recipient.toLowerCase())
            )
        );
    }

    private areValidFilters(filters: SubscriptionFilter[]): boolean {
        if (!Array.isArray(filters) || filters.length === 0) return false;
        
        return filters.every(filter => {
            switch (filter.type) {
                case 'CATEGORY':
                case 'RECIPIENTS':
                case 'FROM':
                    return Array.isArray(filter.value) && filter.value.length > 0;
                default:
                    return false;
            }
        });
    }

    /**
     * Handles client disconnection events.
     * Implements reconnection window for specific disconnect codes.
     * 
     * @param clientId - Client identifier
     * @param code - Disconnection status code
     * @param reason - Disconnection reason
     */
    private handleClientDisconnection(clientId: string, code: number, reason: string) {
        const client = this.clients.get(clientId);
        if (!client) return;

        this.log.info(`Client disconnected: ${clientId}, code: ${code}, reason: ${reason}`);
        
        if (code === 1001 || code === 1006) {
            setTimeout(() => {
                if (this.clients.has(clientId)) {
                    this.clients.delete(clientId);
                }
            }, CONSTANTS.RECONNECT_WINDOW);
        } else {
            this.clients.delete(clientId);
        }
    }

    /**
     * Sends formatted message to specific client.
     * Handles connection state validation and error logging.
     * 
     * @param clientId - Target client identifier
     * @param message - Message to send
     */
    private sendToClient(clientId: string, message: WSMessage) {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) return;

        try {
            client.ws.send(JSON.stringify(message));
            this.log.debug(`Sent ${message.type} to client ${clientId}`);
        } catch (error) {
            this.log.error(`Failed to send ${message.type} to client ${clientId}: %o`, error);
        }
    }

    private sendWelcomeMessage(clientId: string) {
        this.sendToClient(clientId, {
            type: 'WELCOME',
            data: { clientId },
            timestamp: Date.now()
        });
    }

    private sendErrorMessage(clientId: string) {
        this.sendToClient(clientId, {
            type: 'ERROR',
            data: { error: 'Invalid message format' },
            timestamp: Date.now()
        });
    }

    private sendSubscribeError(clientId: string, error: string) {
        this.sendToClient(clientId, {
            type: 'SUBSCRIBE_ERROR',
            data: { error },
            timestamp: Date.now()
        });
    }

    private sendHandshakeError(clientId: string, error: string) {
        this.sendToClient(clientId, {
            type: 'HANDSHAKE_ACK',
            data: { success: false, error },
            timestamp: Date.now()
        });
    }

    private sendSubscribeAck(clientId: string, subscriptionId: string, filters: SubscriptionFilter[]) {
        this.sendToClient(clientId, {
            type: 'SUBSCRIBE_ACK',
            data: { 
                success: true,
                subscriptionId,
                filters
            },
            timestamp: Date.now()
        });
    }

    private sendPongMessage(clientId: string) {
        this.sendToClient(clientId, {
            type: 'PONG',
            data: { success: true },
            timestamp: Date.now()
        });
    }

    /**
     * Generates a unique subscription identifier using timestamp and random string.
     * @returns A unique subscription ID in the format 'sub_[timestamp]_[random]'
     */
    private generateSubscriptionId(): string {
        return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    private generateClientId(): string {
        return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    private areFiltersEqual(filters1: SubscriptionFilter[], filters2: SubscriptionFilter[]): boolean {
        if (filters1.length !== filters2.length) return false;
        
        return filters1.every((filter1, index) => {
            const filter2 = filters2[index];
            return filter1.type === filter2.type && 
                   JSON.stringify(filter1.value) === JSON.stringify(filter2.value);
        });
    }

    /**
     * Gracefully shuts down the WebSocket server and closes all client connections.
     */
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