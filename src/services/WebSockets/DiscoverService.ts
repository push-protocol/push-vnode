// src/services/DiscoveryService.ts
import WebSocket from 'ws';
import { DiscoveryConfig } from './types';
import { EnvLoader } from "../../utilz/envLoader";
import { NodeInfo } from '../messaging-common/validatorContractState';
import { WinstonUtil } from '../../utilz/winstonUtil';
import { EventEmitter } from 'events';
import { ArrayUtil } from '../../utilz/arrayUtil';

/**
 * Service responsible for discovering and maintaining connections to Archive Nodes (ANodes).
 * Manages health checks and ensures a minimum number of active connections are maintained.
 * Emits events when connection state changes.
 * 
 * Events:
 * - 'minimumNodesConnected': Emitted when minimum required connections are established
 * - 'minimumNodesLost': Emitted when connections fall below minimum threshold
 */
export class DiscoveryService extends EventEmitter {
    private archiveNodes = new Map<string, NodeInfo>();
    private refreshInterval: NodeJS.Timer;
    private vNodeId: string;
    private archivalNodes: Map<string, NodeInfo>;
    private readonly log = WinstonUtil.newLog("DiscoveryService");
    private previousState: 'connected' | 'disconnected' = 'disconnected';
    
    constructor(
        private readonly config: DiscoveryConfig
    ) {
        super();
        this.config = {
            refreshInterval: EnvLoader.getPropertyAsNumber("DISCOVERY_REFRESH_INTERVAL", 900000),
            healthCheckTimeout: EnvLoader.getPropertyAsNumber("DISCOVERY_HEALTH_CHECK_TIMEOUT", 30000),
            minArchiveNodes: EnvLoader.getPropertyAsNumber("DISCOVERY_MIN_ARCHIVE_NODES", 2)
        };
    }

    /**
     * Initializes the discovery service and starts periodic health checks.
     * Attempts initial connections and sets up refresh interval.
     * 
     * @param vNodeId - Unique identifier for the validator node
     * @param archivalNodes - Map of available archive nodes to connect to
     */
    async initialize(vNodeId: string, archivalNodes: Map<string, NodeInfo>) {
        this.vNodeId = vNodeId;
        this.archivalNodes = archivalNodes;

        // Initial connection - single attempt
        const initialSuccess = await this.ensureMinimumConnections();
        
        // Set initial state
        this.previousState = initialSuccess ? 'connected' : 'disconnected';
        
        // Emit initial state
        if (initialSuccess) {
            this.emit('minimumNodesConnected');
        } else {
            this.emit('minimumNodesLost');
        }

        // Start periodic refresh
        this.refreshInterval = setInterval(
            async () => {
                await this.refreshNodeStatus();
                
                // Check current state
                const currentState = this.archiveNodes.size >= this.config.minArchiveNodes 
                    ? 'connected' 
                    : 'disconnected';
                
                // Only emit events if state has changed
                if (currentState !== this.previousState) {
                    if (currentState === 'connected') {
                        this.emit('minimumNodesConnected');
                    } else {
                        this.log.error('Lost minimum required ANode connections, triggering cleanup');
                        this.emit('minimumNodesLost');
                    }
                    this.previousState = currentState;
                }
            },
            this.config.refreshInterval
        );
    }

    /**
     * Attempts to establish minimum required connections to archive nodes.
     * Randomly shuffles available nodes and attempts connections until minimum is reached.
     * 
     * @returns Promise<boolean> - True if minimum connections established, false otherwise
     */
    private async ensureMinimumConnections(): Promise<boolean> {
        this.log.info(`Available ANodes: ${this.archivalNodes.size}, Needed connections to: ${this.config.minArchiveNodes}`);
            
        // Get all available nodes
        const availableNodes = Array.from(this.archivalNodes.entries());

        // Randomize the order of connection attempts
        const shuffledNodes = ArrayUtil.shuffleArray(availableNodes);
        
        // Try each available node until we reach our minimum or run out of nodes
        for (const [nodeId, nodeInfo] of shuffledNodes) {
            if (this.archiveNodes.size >= this.config.minArchiveNodes) {
                this.log.info('Reached minimum required connections');
                break;
            }
            
            const wsUrl = nodeInfo.url.replace(/^http/, 'ws').replace(/^https/, 'wss');
            await this.addNode(wsUrl, nodeInfo);
        }

        const success = this.archiveNodes.size >= this.config.minArchiveNodes;
        if (!success) {
            this.log.warn(`Initial connection attempt: Could not establish minimum required connections. ` +
                       `Connected: ${this.archiveNodes.size}, Required: ${this.config.minArchiveNodes}. ` +
                       `Periodic refresh will continue trying.`);
        } else {
            this.log.info(`Successfully established initial ${this.archiveNodes.size} connections`);
        }
        
        return success;
    }

    /**
     * Returns list of currently active and healthy archive nodes.
     * 
     * @returns Promise<NodeInfo[]> - Array of active node information
     */
    async getActiveArchiveNodes(): Promise<NodeInfo[]> {
        const nodes = Array.from(this.archiveNodes.values());
        return nodes.filter(node => node.nodeStatus === 0);
    }

    private async addNode(wsUrl: string, nodeInfo: NodeInfo) {
        try {
            const isHealthy = await this.checkNodeHealth(wsUrl);
            if (isHealthy) {
                this.archiveNodes.set(nodeInfo.nodeId, nodeInfo);
                this.log.info(`Successfully added healthy ANode ${nodeInfo.nodeId} with url: ${wsUrl}`);
            } else {
                this.log.warn(`ANode ${nodeInfo.nodeId} not added - health check failed`);
            }
        } catch (error) {
            this.log.error(`Failed to add node ${wsUrl}: %o`, error);
        }
    }

    /**
     * Performs health check on a node via WebSocket connection.
     * Tests connection, authentication, and health check response within timeout period.
     * 
     * @param wsUrl - WebSocket URL of the node to check
     * @returns Promise<boolean> - True if node is healthy, false otherwise
     */
    private async checkNodeHealth(wsUrl: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {                
                const ws = new WebSocket(wsUrl, {
                    headers: {
                        'validator-address': this.vNodeId
                    }
                });

                ws.on('open', () => {
                    this.log.info(`WebSocket connection opened to ANode at ${wsUrl}`);
                });
                
                const timeout = setTimeout(() => {
                    this.log.warn(`Health check timed out for ANode at ${wsUrl}`);
                    cleanup();
                    ws.close();
                    resolve(false);
                }, this.config.healthCheckTimeout);

                ws.on('message', (data: Buffer) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.log.info(`Received ${message.type} from ANode at ${wsUrl}: %o`, message);

                        if (message.type === 'AUTH_CHALLENGE' && message.nonce) {
                            const healthCheck = {
                                type: 'HEALTH_CHECK',
                                timestamp: Date.now()
                            };
                            this.log.info(`Sending health check to ANode at ${wsUrl}: ${healthCheck.timestamp}`);
                            ws.send(JSON.stringify(healthCheck));
                        } else if (message.type === 'HEALTH_CHECK_RESPONSE') {
                            this.log.info(`Health check is successful from ANode at ${wsUrl}: ${message.timestamp}`);
                            cleanup();
                            ws.close(1000, 'Health check complete');
                            resolve(true);
                        }
                    } catch (error) {
                        this.log.error(`Failed to process message from ANode at ${wsUrl}: %o`, error);
                        cleanup();
                        ws.close();
                        resolve(false);
                    }
                });

                ws.on('error', (error) => {
                    this.log.error(`WebSocket error for ANode at ${wsUrl}: %o`, error);
                    cleanup();
                    resolve(false);
                });

                const cleanup = () => {
                    clearTimeout(timeout);
                    ws.removeAllListeners();
                };
            } catch (error) {
                this.log.error(`Failed to establish WebSocket connection to ANode at ${wsUrl}: %o`, error);
                resolve(false);
            }
        });
    }

    /**
     * Periodic refresh of node status. Checks health of all connected nodes
     * and attempts to establish new connections if below minimum threshold.
     * Updates internal state and emits events on state changes.
     */
    private async refreshNodeStatus() {
        this.log.info(`Refreshing node status...`);
        const updatedNodes = new Map<string, NodeInfo>();

        // First check existing nodes
        for (const [nodeId, nodeInfo] of this.archiveNodes.entries()) {
            const wsUrl = nodeInfo.url.replace(/^http/, 'ws').replace(/^https/, 'wss');
            const isHealthy = await this.checkNodeHealth(wsUrl);
            if (isHealthy) {
                updatedNodes.set(nodeId, {
                    ...nodeInfo,
                    nodeStatus: 0
                });
            } else {
                this.log.warn(`ANode at ${wsUrl} is no longer healthy, removing from active nodes`);
            }
        }

        // Update the archive nodes map with currently healthy nodes
        this.archiveNodes = updatedNodes;

        // If we're below minimum, try to establish more connections
        if (this.archiveNodes.size < this.config.minArchiveNodes) {
            this.log.info(`Healthy nodes (${this.archiveNodes.size}) below minimum (${this.config.minArchiveNodes}), attempting to establish more connections`);
            await this.ensureMinimumConnections();
        } else {
            this.log.info(`Successfully maintaining ${this.archiveNodes.size} healthy archive nodes`);
        }
    }

    /**
     * Cleans up resources by clearing refresh interval.
     */
    async destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    /**
     * Returns the minimum number of archive nodes required for operation.
     * 
     * @returns number - Minimum required archive nodes
     */
    public getMinArchiveNodes(): number {
        return this.config.minArchiveNodes;
    }
}
