import { Service } from 'typedi';
import WebSocket from 'ws';
import { WinstonUtil } from "../../utilz/winstonUtil";
import { WSMessage, AuthResponse, BlockReceivedMessage } from './types';
import { DiscoveryService } from './DiscoverService';
import { BlockStatusManager } from './BlockStatusManager';
import { NodeInfo } from '../messaging-common/validatorContractState';
import { BitUtil } from '../../utilz/bitUtil';
import { EthUtil } from '../../utilz/ethUtil';
import { Wallet } from 'ethers';

/**
 * Manages WebSocket connections to Archive Nodes, handling authentication, 
 * reconnection logic, and message processing.
 * Maintains connection state and ensures minimum required connections are available.
 */
@Service()
export class WebSocketClient {
    private archiveConnections = new Map<string, WebSocket>();
    private readonly log = WinstonUtil.newLog("WebSocketClient");
    private reconnectTimer: NodeJS.Timer;
    private readonly maxReconnectAttempts = 5;
    private readonly baseReconnectDelay = 1000; // Start with 1 second
    private readonly nodeId: string;
    private vNodeId: string;
    private wallet: Wallet;
    private reconnectAttempts = new Map<string, number>();
    private readonly CONNECTION_TIMEOUT = 65000;  // 65 seconds (matches server)
    private readonly PING_INTERVAL = 60000;      // 60 seconds (matches server's HEARTBEAT_INTERVAL)
    private readonly MONITOR_INTERVAL = 30000;   // 30 seconds (check more frequently than ping interval)
    private readonly MAX_RECONNECT_DELAY = 32000; // 32 seconds (this is fine)
    private connectionStates = new Map<string, {
        lastPing?: number;
        lastPong?: number;
        isReconnecting: boolean;
    }>();
    
    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly blockManager: BlockStatusManager,
    ) {}

    /**
     * Initializes the WebSocket client with validator ID and wallet.
     * Establishes initial connections and starts monitoring.
     * 
     * @param vNodeId - Validator node identifier
     * @param wallet - Ethereum wallet for authentication
     * @throws Error if initialization fails
     */
    async postConstruct(vNodeId: string, wallet: Wallet) {
        try {
            this.vNodeId = vNodeId;
            this.wallet = wallet;
            await this.initializeConnections();
            this.startConnectionMonitoring();
            this.log.info('WebSocket client initialized');
        } catch (error) {
            this.log.error('Failed to initialize WebSocket client: %o', error);
            throw error;
        }
    }

    /**
     * Establishes connections to archive nodes up to the minimum required count.
     * @throws Error if insufficient active nodes are available
     */
    private async initializeConnections() {
        this.log.info('Initializing archive node connections');
        const activeNodes = await this.discoveryService.getActiveArchiveNodes();
        
        if (activeNodes.length < this.MIN_ARCHIVE_CONNECTIONS) {
            throw new Error(`Insufficient Active Archive Nodes. Need ${this.MIN_ARCHIVE_CONNECTIONS}, got ${activeNodes.length}`);
        }

        for (const node of activeNodes) {
            if (this.archiveConnections.size < this.MIN_ARCHIVE_CONNECTIONS) {
                await this.connectToArchiveNode(node);  // Pass the entire node info
            }
        }
    }

    /**
     * Establishes a WebSocket connection to an archive node with authentication.
     * Handles the complete connection flow including challenge-response authentication.
     * 
     * @param node - Archive node information
     * @returns Promise that resolves when connection is established and authenticated
     */
    private async connectToArchiveNode(node: NodeInfo) {        
        if (this.archiveConnections.has(node.nodeId)) {
            this.log.warn(`Already connected to node ${node.nodeId}`);
            return;
        }

        const wsUrl = node.url.replace(/^http/, 'ws').replace(/^https/, 'wss');

        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(wsUrl, {
                headers: {
                    'validator-address': this.vNodeId
                }
            });
            
            const timeout = setTimeout(() => {
                cleanup();
                ws.terminate();
                reject(new Error(`[${this.vNodeId}] Connection timeout: ${node.nodeId}`));
            }, this.CONNECTION_TIMEOUT);

            // Handle authentication flow
            const handleAuth = async (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    if (message.type === 'AUTH_CHALLENGE') {
                        // Sign the nonce using EthUtil
                        this.log.info(`Received auth challenge from ${node.nodeId}: ${message.nonce}`);
                        
                        const signatureBytes = await EthUtil.signBytes(
                            this.wallet,
                            BitUtil.base16ToBytes(message.nonce)
                        );
                        const signature = BitUtil.bytesToBase16(signatureBytes);

                        // Send auth response
                        const response: AuthResponse = {
                            type: 'AUTH_RESPONSE',
                            nonce: message.nonce,
                            signature,
                            validatorAddress: this.vNodeId
                        };
                        this.log.info(`Sending auth response to ${node.nodeId}: %o`, response);
                        ws.send(JSON.stringify(response));
                    } else if (message.type === 'AUTH_SUCCESS') {
                        this.log.info(`Authentication successful for ${node.nodeId}`);
                        ws.removeListener('message', handleAuth);
                        cleanup();
                        this.archiveConnections.set(node.nodeId, ws);
                        this.setupWebSocketHandlers(node.nodeId, ws);
                        this.subscribeToEvents(ws, node.nodeId);
                        this.reconnectAttempts.delete(node.nodeId);
                        resolve();
                    }
                } catch (error) {
                    cleanup();
                    ws.terminate();
                    reject(new Error(`Authentication failed: ${error.message}`));
                }
            };

            const onOpen = () => {
                // Wait for auth challenge
                ws.on('message', handleAuth);
            };

            const onError = (error: Error) => {
                cleanup();
                ws.terminate();
                this.log.error(`[${this.vNodeId}] Connection error to ${node.nodeId}: %o`, error);
                reject(error);
            };

            const cleanup = () => {
                clearTimeout(timeout);
                ws.removeListener('open', onOpen);
                ws.removeListener('error', onError);
                ws.removeListener('message', handleAuth);
            };

            ws.on('open', onOpen);
            ws.on('error', onError);
        });
    }

    /**
     * Subscribes to block events from an archive node.
     * 
     * @param ws - WebSocket connection
     * @param nodeId - Archive node identifier
     */
    private subscribeToEvents(ws: WebSocket, nodeId: string) {
        const subscribeMessage = {
            type: 'SUBSCRIBE',
            nodeId: this.vNodeId,
            nodeType: 'VALIDATOR',
            events: ['BLOCK']
        };
        
        try {
            ws.send(JSON.stringify(subscribeMessage));
            this.log.debug(`vNode ${this.vNodeId} subscribed to events on anode ${nodeId}: %o`, subscribeMessage);
        } catch (error) {
            this.log.error(`vNode ${this.vNodeId} failed to subscribe to events on anode ${nodeId}: %o`, error);
            ws.close();
        }
    }

    /**
     * Processes incoming messages from archive nodes.
     * Currently handles BLOCK messages and forwards them to BlockStatusManager.
     * 
     * @param nodeId - Source archive node identifier
     * @param message - Received WebSocket message
     */
    private handleArchiveMessage(nodeId: string, message: WSMessage) {
        if (message.type === 'BLOCK') {
            const blockData = (message as BlockReceivedMessage).data;
            
            if (!blockData?.blockHash ) {
                this.log.warn(`Received invalid BLOCK message structure from ${nodeId}: %o`, message);
                return;
            }

            // blockData is already a FilterBlockResponse type with {blockHash, txs}
            this.blockManager.handleBlockConfirmation(
                blockData.blockHash,
                nodeId,
                blockData
            );
        } else {
            this.log.warn(`Received unexpected message type from ${nodeId}: %o`, message);
        }
    }

    /**
     * Sets up WebSocket event handlers for a connection.
     * Handles messages, connection closure, errors, and ping/pong heartbeat.
     * 
     * @param nodeId - Archive node identifier
     * @param ws - WebSocket connection
     */
    private setupWebSocketHandlers(nodeId: string, ws: WebSocket) {
        const messageHandler = (data: string) => {
            try {
                const message = JSON.parse(data) as WSMessage;
                this.handleArchiveMessage(nodeId, message);
            } catch (error) {
                this.log.error(`Message parsing error from ${nodeId}: %o`, error);
            }
        };

        const closeHandler = async (event: { code: number; reason: string }) => {
            this.log.warn(`Disconnected from Archive Node: ${nodeId}. Code: ${event.code}, Reason: ${event.reason}`);
            cleanup();
            this.archiveConnections.delete(nodeId);
            
            // Force terminate if close takes too long
            const terminateTimeout = setTimeout(() => {
                ws.terminate();
            }, 5000);
            
            // Attempt immediate reconnection for unexpected closures
            if (event.code !== 1000) { // 1000 is normal closure
                await this.handleDisconnect(nodeId);
            }
            
            clearTimeout(terminateTimeout);
        };

        const errorHandler = (error: Error) => {
            this.log.error(`WebSocket error for ${nodeId}: %o`, error);
            ws.close();
        };

        // Add ping/pong tracking
        ws.on('ping', () => {
            this.updateConnectionState(nodeId, {
                lastPing: Date.now()
            });
        });

        ws.on('pong', () => {
            this.updateConnectionState(nodeId, {
                lastPong: Date.now()
            });
        });

        // Setup heartbeat with state tracking
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                this.updateConnectionState(nodeId, { lastPing: Date.now() });
                ws.ping((err) => {
                    if (err) {
                        this.log.warn(`Ping failed for ${nodeId}: %o`, err);
                        ws.close();
                    }
                });
            }
        }, this.PING_INTERVAL);

        const cleanup = () => {
            clearInterval(pingInterval);
            ws.removeListener('message', messageHandler);
            ws.removeListener('close', closeHandler);
            ws.removeListener('error', errorHandler);
        };

        ws.on('message', messageHandler);
        ws.on('close', closeHandler);
        ws.on('error', errorHandler);
    }

    /**
     * Handles disconnection from an archive node.
     * Implements exponential backoff reconnection strategy.
     * Falls back to alternative nodes if reconnection fails.
     * 
     * @param nodeId - Disconnected node identifier
     */
    private async handleDisconnect(nodeId: string) {
        const attempts = this.reconnectAttempts.get(nodeId) || 0;
        
        this.updateConnectionState(nodeId, { isReconnecting: true });
        
        if (attempts >= this.maxReconnectAttempts) {
            this.log.error(`Max reconnection attempts reached for node ${nodeId}`);
            this.reconnectAttempts.delete(nodeId);
            this.updateConnectionState(nodeId, { isReconnecting: false });
            await this.findAlternativeNode();
            return;
        }

        const delay = this.getReconnectDelay(attempts); // Use the helper method
        this.log.info(`Attempting to reconnect to ${nodeId} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            const nodes = await this.discoveryService.getActiveArchiveNodes();
            const nodeInfo = nodes.find(n => n.nodeId === nodeId);
            
            if (nodeInfo) {
                await this.connectToArchiveNode(nodeInfo);
                this.log.info(`Successfully reconnected to ${nodeId}`);
            } else {
                throw new Error(`Node ${nodeId} no longer available`);
            }
        } catch (error) {
            this.log.error(`Failed to reconnect to ${nodeId}: %o`, error);
            this.reconnectAttempts.set(nodeId, attempts + 1);
            
            if ((attempts + 1) >= this.maxReconnectAttempts) {
                await this.findAlternativeNode();
            }
        }
    }

    /**
     * Attempts to find and connect to an alternative archive node.
     * Used when primary connections fail or are insufficient.
     */
    private async findAlternativeNode() {
        try {
            const activeNodes = await this.discoveryService.getActiveArchiveNodes();
            const unusedNodes = activeNodes.filter(node => 
                !this.archiveConnections.has(node.nodeId)
            );

            if (unusedNodes.length > 0) {
                this.log.info('Attempting to connect to alternative node');
                await this.connectToArchiveNode(unusedNodes[0]);
            }
        } catch (error) {
            this.log.error('Failed to find alternative node: %o', error);
        }
    }

    /**
     * Starts periodic connection monitoring.
     * Checks connection health and restores connections if needed.
     */
    private startConnectionMonitoring() {
        this.reconnectTimer = setInterval(() => {
            this.checkAndRestoreConnections();
        }, this.MONITOR_INTERVAL); // Check connections every minute
    }

    /**
     * Gracefully shuts down all WebSocket connections.
     * Cleans up resources and connection states.
     */
    async shutdown() {
        try {
            if (this.reconnectTimer) {
                clearInterval(this.reconnectTimer);
            }

            const closePromises = Array.from(this.archiveConnections.entries()).map(([nodeId, ws]) => {
                return new Promise<void>((resolve) => {
                    this.log.info(`Closing connection to ${nodeId}`);
                    ws.once('close', () => resolve());
                    ws.close(1000, 'Shutdown requested');
                });
            });

            await Promise.all(closePromises);
            
            this.archiveConnections.clear();
            this.reconnectAttempts.clear();
        } catch (error) {
            this.log.error('Error during shutdown: %o', error);
        }
    }

    private async checkAndRestoreConnections() {
        try {
            // First validate existing connections
            await this.validateConnections();

            const activeConnections = Array.from(this.archiveConnections.entries())
                .filter(([_, ws]) => ws.readyState === WebSocket.OPEN);

            if (activeConnections.length < this.MIN_ARCHIVE_CONNECTIONS) {
                this.log.warn(`Active connections (${activeConnections.length}) below minimum (${this.MIN_ARCHIVE_CONNECTIONS})`);
                await this.initializeConnections();
            }
        } catch (error) {
            this.log.error('Failed to restore connections: %o', error);
        }
    }

    private isConnectionValid(ws: WebSocket): boolean {
        return ws.readyState === WebSocket.OPEN;
    }

    /**
     * Validates existing connections and removes stale ones.
     * Checks both WebSocket state and ping/pong timeouts.
     */
    private async validateConnections() {
        const now = Date.now();
        for (const [nodeId, ws] of this.archiveConnections) {
            const state = this.connectionStates.get(nodeId);
            
            // Check if connection is stale (no pong received within timeout)
            if (state?.lastPong && (now - state.lastPong > this.CONNECTION_TIMEOUT)) {
                this.log.warn(`Connection stale for ${nodeId} - no pong received`);
                ws.close();
                this.archiveConnections.delete(nodeId);
                continue;
            }
            
            if (!this.isConnectionValid(ws)) {
                this.log.warn(`Invalid connection detected for ${nodeId}`);
                ws.close();
                this.archiveConnections.delete(nodeId);
            }
        }
    }

    /**
     * Calculates reconnection delay using exponential backoff.
     * 
     * @param attempts - Number of previous reconnection attempts
     * @returns Delay in milliseconds before next reconnection attempt
     */
    private getReconnectDelay(attempts: number): number {
        const delay = this.baseReconnectDelay * Math.pow(2, attempts);
        return Math.min(delay, this.MAX_RECONNECT_DELAY);
    }

    /**
     * Updates the connection state for a node.
     * Tracks ping/pong timestamps and reconnection status.
     * 
     * @param nodeId - Archive node identifier
     * @param update - Partial state update
     */
    private updateConnectionState(nodeId: string, update: Partial<{
        lastPing: number;
        lastPong: number;
        isReconnecting: boolean;
    }>) {
        const current = this.connectionStates.get(nodeId) || {
            isReconnecting: false
        };
        this.connectionStates.set(nodeId, { ...current, ...update });
    }

    /**
     * Gets the minimum required archive node connections from discovery service
     */
    private get MIN_ARCHIVE_CONNECTIONS(): number {
        return this.discoveryService.getMinArchiveNodes();
    }
}