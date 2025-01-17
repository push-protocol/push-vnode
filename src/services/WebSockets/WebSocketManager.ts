// src/services/WebSockets/WebSocketManager.ts
import { Service } from 'typedi';
import { WinstonUtil } from "../../utilz/winstonUtil";
import { WebSocketClient } from './WebSocketClient';
import { WebSocketServer } from './WebSocketServer';
import { DiscoveryService } from './DiscoverService';
import { BlockStatusManager } from './BlockStatusManager';
import { NodeInfo } from '../messaging-common/validatorContractState';
import { Wallet } from 'ethers'

@Service()
export class WebSocketManager {
    private readonly log = WinstonUtil.newLog(WebSocketManager);
    private cleanupInterval?: NodeJS.Timeout;

    constructor(
        private readonly wsClient: WebSocketClient,
        private readonly wsServer: WebSocketServer,
        private readonly blockManager: BlockStatusManager,
        private readonly discoveryService: DiscoveryService
    ) {}
    
    async postConstruct(vNodeId: string, wallet: Wallet, archivalNodes: Map<string, NodeInfo>) {
        try {  
            if (!archivalNodes) {
                throw new Error('archivalNodes is undefined');
            }
            
            await this.discoveryService.initialize(vNodeId, archivalNodes);
            await this.wsServer.postConstruct();
            await this.wsClient.postConstruct(vNodeId, wallet);

            // Store interval reference
            this.cleanupInterval = setInterval(() => {
                this.blockManager.performCleanup();
            }, 60 * 60 * 1000); // Every hour

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
        } catch (error) {
            this.log.error('Failed to initialize WebSocket manager:', error);
            throw error;
        }
    }

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