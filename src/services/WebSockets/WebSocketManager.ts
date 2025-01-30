// src/services/WebSockets/WebSocketManager.ts
import { Service } from 'typedi';
import { WinstonUtil } from "../../utilz/winstonUtil";
import { WebSocketClient } from './WebSocketClient';
import { WebSocketServer } from './WebSocketServer';
import { DiscoveryService } from './DiscoverService';
import { BlockStatusManager } from './BlockStatusManager';
import { NodeInfo } from '../messaging-common/validatorContractState';
import { Wallet } from 'ethers'
import { Server } from 'http';

/**
 * Manages WebSocket server and client components for the Push vNode.
 * Coordinates initialization, shutdown, and lifecycle management based on archival node availability.
 * Handles the orchestration between WebSocket server, client, and discovery service components.
 */
@Service()
export class WebSocketManager {
    private readonly log = WinstonUtil.newLog(WebSocketManager);
    private cleanupInterval?: NodeJS.Timeout;
    private wsServerInitialized = false;
    private wsClientInitialized = false;
    private pendingServer: Server | null = null;
    private pendingVNodeId: string | null = null;
    private pendingWallet: Wallet | null = null;

    /**
     * Initializes the WebSocket manager with required dependencies.
     * @param wsClient - WebSocket client for connecting to other nodes
     * @param wsServer - WebSocket server for handling incoming connections
     * @param blockManager - Manages block status and cleanup
     * @param discoveryService - Handles archival node discovery and connection management
     */
    constructor(
        private readonly wsClient: WebSocketClient,
        private readonly wsServer: WebSocketServer,
        private readonly blockManager: BlockStatusManager,
        private readonly discoveryService: DiscoveryService
    ) {}
    
    private displayInitializationArtwork() {
        let artwork = 
`
 ____            _     __   __    _ _     _       _             
|  _ \\ _   _ ___| |__  \\ \\ / /_ _| (_) __| | __ _| |_ ___  _ __ 
| |_) | | | / __| '_ \\  \\ V / _\` | | |/ _\` |/ _\` | __/ _ \\| '__|
|  __/| |_| \\__ \\ | | |  | | (_| | | | (_| | (_| | || (_) | |   
|_|   \\__,_|___/_| |_|  |_|\\__,_|_|_|\\__,_|\\__,_|\\__\\___/|_|   
__        __   _    ____            _        _   
\\ \\      / /__| |__/ ___|  ___  ___| | _____| |_ 
 \\ \\ /\\ / / _ \\ '_ \\___ \\ / _ \\/ __| |/ / _ \\ __|
  \\ V  V /  __/ |_) |__) |  __/ (__|   <  __/ |_ 
   \\_/\\_/ \\___|_.__/____/ \\___|\\___|_|\\_\\___|\\__|
`;

        console.log(`
            ################################################
            ${artwork}

            🛡️ WebSocket Server and Client Initialized Successfully 🛡️
            ################################################
        `);
    }

    /**
     * Initializes the WebSocket components after class construction.
     * Sets up event handlers for node discovery and manages component lifecycle.
     * @param vNodeId - Unique identifier for this validator node
     * @param wallet - Ethereum wallet for authentication
     * @param archivalNodes - Map of available archival nodes
     * @param server - HTTP server instance to attach WebSocket server to
     * @throws Error if archivalNodes is undefined or initialization fails
     */
    async postConstruct(vNodeId: string, wallet: Wallet, archivalNodes: Map<string, NodeInfo>, server: Server) {
        try {
            if (!archivalNodes) {
                throw new Error('archivalNodes is undefined');
            }

            // Store these for later use if needed
            this.pendingServer = server;
            this.pendingVNodeId = vNodeId;
            this.pendingWallet = wallet;

            // Set up discovery service event handlers
            this.discoveryService.on('minimumNodesConnected', async () => {
                if (!this.wsServerInitialized || !this.wsClientInitialized) {
                    try {
                        if (!this.wsServerInitialized) {
                            await this.wsServer.postConstruct(this.pendingServer!);
                            this.wsServerInitialized = true;
                            this.log.info('WebSocket server initialized after meeting minimum node requirement');
                        }
                        
                        if (!this.wsClientInitialized) {
                            await this.wsClient.postConstruct(this.pendingVNodeId!, this.pendingWallet!);
                            this.wsClientInitialized = true;
                            this.log.info('WebSocket client initialized after meeting minimum node requirement');
                        }

                        if (this.wsServerInitialized && this.wsClientInitialized) {
                            this.displayInitializationArtwork();
                        }
                    } catch (error) {
                        this.log.error('Failed to initialize WebSocket components: %o', error);
                    }
                }
            });

            this.discoveryService.on('minimumNodesLost', async () => {
                this.log.warn('Minimum required archive nodes not available, shutting down WebSocket components');
                
                try {
                    // Cleanup WebSocket components
                    if (this.wsServerInitialized) {
                        await this.wsServer.shutdown();
                        this.wsServerInitialized = false;
                        this.log.info('WebSocket server shut down due to insufficient ANodes');
                    }
                    
                    if (this.wsClientInitialized) {
                        await this.wsClient.shutdown();
                        this.wsClientInitialized = false;
                        this.log.info('WebSocket client shut down due to insufficient ANodes');
                    }
                } catch (error) {
                    this.log.error('Error during WebSocket components shutdown: %o', error);
                }
            });

            // Initialize discovery service
            await this.discoveryService.initialize(vNodeId, archivalNodes);

            // Store interval reference
            this.cleanupInterval = setInterval(() => {
                this.blockManager.performCleanup();
            }, 15 * 60 * 1000); // Every 15 minutes

        } catch (error) {
            this.log.error('Failed to initialize WebSocketManager: %o', error);
            throw error;
        }
    }

    /**
     * Gracefully shuts down all WebSocket components and cleans up resources.
     * Clears cleanup interval and terminates both client and server connections.
     */
    async shutdown() {
        // Clear the interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Cleanup components
        await this.wsClient.shutdown();
        await this.wsServer.shutdown();
    }
}