// src/services/DiscoveryService.ts
import WebSocket from 'ws';
import { DiscoveryConfig } from './types';
import { EnvLoader } from "../../utilz/envLoader";
import { NodeInfo } from '../messaging-common/validatorContractState';
import { WinstonUtil } from '../../utilz/winstonUtil';

export class DiscoveryService {
    private archiveNodes = new Map<string, NodeInfo>();
    private refreshInterval: NodeJS.Timer;
    private vNodeId: string;
    private archivalNodes: Map<string, NodeInfo>;
    private readonly log = WinstonUtil.newLog("DiscoveryService");
    
    constructor(
        private readonly config: DiscoveryConfig
    ) {
        this.config = {
            refreshInterval: EnvLoader.getPropertyAsNumber("DISCOVERY_REFRESH_INTERVAL", 60000),
            healthCheckTimeout: EnvLoader.getPropertyAsNumber("DISCOVERY_HEALTH_CHECK_TIMEOUT", 5000),
            minArchiveNodes: EnvLoader.getPropertyAsNumber("DISCOVERY_MIN_ARCHIVE_NODES", 1),
            maxRetries: EnvLoader.getPropertyAsNumber("DISCOVERY_MAX_CONNECTION_RETRIES", 3)
        };
    }

    async initialize(vNodeId: string, archivalNodes: Map<string, NodeInfo>) {
        this.vNodeId = vNodeId;
        this.archivalNodes = archivalNodes;

        // Initial connection with retry mechanism
        await this.ensureMinimumConnections();

        // Start periodic refresh
        this.refreshInterval = setInterval(
            () => this.refreshNodeStatus(),
            this.config.refreshInterval
        );
    }

    private async ensureMinimumConnections(): Promise<void> {
        let retryCount = 0;
        
        while (this.archiveNodes.size < this.config.minArchiveNodes && retryCount < this.config.maxRetries) {
            this.log.info(`Attempting to establish minimum ANode connections. Current: ${this.archiveNodes.size}, Target: ${this.config.minArchiveNodes}`);
            
            // Get available nodes that aren't already connected
            const availableNodes = Array.from(this.archivalNodes.entries())
                .filter(([nodeId]) => !this.archiveNodes.has(nodeId));

            if (availableNodes.length === 0) {
                this.log.error('No more available nodes to connect to');
                break;
            }

            // Shuffle available nodes for random selection
            const shuffledNodes = this.shuffleArray(availableNodes);

            // Try to connect to nodes until we reach minimum or run out of nodes
            for (const [nodeId, nodeInfo] of shuffledNodes) {
                if (this.archiveNodes.size >= this.config.minArchiveNodes) break;
                
                const wsUrl = nodeInfo.url.replace(/^http/, 'ws').replace(/^https/, 'wss');
                await this.addNode(wsUrl, nodeInfo);
            }

            retryCount++;
            
            if (this.archiveNodes.size < this.config.minArchiveNodes) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
            }
        }

        if (this.archiveNodes.size < this.config.minArchiveNodes) {
            this.log.error(`Failed to establish minimum required connections. Current: ${this.archiveNodes.size}, Required: ${this.config.minArchiveNodes}`);
        }
    }

    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    async getActiveArchiveNodes(): Promise<NodeInfo[]> {
        const nodes = Array.from(this.archiveNodes.values());
        return nodes.filter(node => node.nodeStatus === 0);
    }

    private async addNode(wsUrl: string, nodeInfo: NodeInfo) {
        try {
            const isHealthy = await this.checkNodeHealth(wsUrl);
            if (isHealthy) {
                this.archiveNodes.set(nodeInfo.nodeId, nodeInfo);
                this.log.info(`Successfully added healthy ANode ${nodeInfo.nodeId}`);
            } else {
                this.log.warn(`ANode ${nodeInfo.nodeId} not added - health check failed`);
            }
        } catch (error) {
            this.log.error(`Failed to add node ${wsUrl}:`, error);
        }
    }

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
                        this.log.info(`Received ${message.type} from ANode at ${wsUrl}:`, JSON.stringify(message, null, 2));

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
                        this.log.error(`Failed to process message from ANode at ${wsUrl}:`, error);
                        cleanup();
                        ws.close();
                        resolve(false);
                    }
                });

                ws.on('error', (error) => {
                    this.log.error(`WebSocket error for ANode at ${wsUrl}:`, error);
                    cleanup();
                    resolve(false);
                });

                const cleanup = () => {
                    clearTimeout(timeout);
                    ws.removeAllListeners();
                };
            } catch (error) {
                this.log.error(`Failed to establish WebSocket connection to ANode at ${wsUrl}:`, error);
                resolve(false);
            }
        });
    }

    private async refreshNodeStatus() {
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

        // If we're below minimum, try to add new nodes
        while (updatedNodes.size < this.config.minArchiveNodes) {
            // Get available nodes that aren't already in use
            const availableNodes = Array.from(this.archivalNodes.entries())
                .filter(([nodeId]) => !updatedNodes.has(nodeId));

            if (availableNodes.length === 0) {
                this.log.error('No more available ANodes to try');
                break;
            }

            // Pick a random available node
            const shuffledNodes = this.shuffleArray(availableNodes);
            const [nodeId, nodeInfo] = shuffledNodes[0];
            
            const wsUrl = nodeInfo.url.replace(/^http/, 'ws').replace(/^https/, 'wss');
            const isHealthy = await this.checkNodeHealth(wsUrl);
            
            if (isHealthy) {
                updatedNodes.set(nodeId, {
                    ...nodeInfo,
                    nodeStatus: 0
                });
                this.log.info(`Added new healthy ANode ${nodeId}`);
            } else {
                this.log.warn(`Attempted ANode ${nodeId} is not healthy, trying another`);
            }
        }

        // Update the archive nodes map
        this.archiveNodes = updatedNodes;

        if (this.archiveNodes.size < this.config.minArchiveNodes) {
            this.log.error(`Failed to maintain minimum required archive nodes. Current: ${this.archiveNodes.size}, Required: ${this.config.minArchiveNodes}`);
        } else {
            this.log.info(`Successfully maintaining ${this.archiveNodes.size} healthy archive nodes`);
        }
    }

    async destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}
