import { Service } from 'typedi';
import { WinstonUtil } from "../../utilz/winstonUtil";
import { BlockData } from './types';
import { WebSocketServer } from './WebSocketServer';

interface BlockConfirmation {
    timestamp: number;
    nodes: Set<string>;
}

@Service()
export class BlockStatusManager {
    private confirmations = new Map<string, BlockConfirmation>();
    private readonly REQUIRED_CONFIRMATIONS = 2;
    private readonly CONFIRMATION_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    private readonly log = WinstonUtil.newLog("BlockStatusManager");

    constructor(private readonly wsServer: WebSocketServer) {}

    async handleBlockConfirmation(blockHash: string, nodeId: string, blockData: BlockData) {
        let confirmation = this.confirmations.get(blockHash);
        if (!confirmation) {
            confirmation = {
                timestamp: Date.now(),
                nodes: new Set()
            };
            this.confirmations.set(blockHash, confirmation);
        }

        confirmation.nodes.add(nodeId);
        this.log.debug(`Block ${blockHash} confirmed by ANode: ${nodeId}. Total confirmations: ${confirmation.nodes.size}`);

        if (confirmation.nodes.size >= this.REQUIRED_CONFIRMATIONS) {
            await this.handleBlockConfirmed(blockHash, blockData);
        }
    }

    private async handleBlockConfirmed(blockHash: string, blockData: BlockData) {
        this.log.info(`Block ${blockHash} reached required confirmations`);
        this.wsServer.broadcastBlockUpdate(blockData);
        this.confirmations.delete(blockHash);
    }

    private cleanupOldConfirmations() {
        const now = Date.now();
        for (const [blockHash, confirmation] of this.confirmations.entries()) {
            if (now - confirmation.timestamp > this.CONFIRMATION_EXPIRY_TIME) {
                this.confirmations.delete(blockHash);
                this.log.debug(`Cleaned up old confirmation for block ${blockHash}`);
            }
        }
    }
    
    public performCleanup() {
        this.cleanupOldConfirmations();
    }
}