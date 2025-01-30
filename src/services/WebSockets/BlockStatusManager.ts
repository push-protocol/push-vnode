import { Service } from 'typedi';
import { WinstonUtil } from "../../utilz/winstonUtil";
import { FilterBlockResponse, BlockConfirmation } from './types';
import { WebSocketServer } from './WebSocketServer';
import { DiscoveryService } from './DiscoverService';

/**
 * Manages the confirmation status of blocks across multiple ANodes.
 * Tracks block confirmations and broadcasts updates when required confirmations are met.
 */
@Service()
export class BlockStatusManager {
    private confirmations = new Map<string, BlockConfirmation>();
    private readonly CONFIRMATION_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes
    private readonly log = WinstonUtil.newLog(BlockStatusManager);

    constructor(
        private readonly wsServer: WebSocketServer,
        private readonly discoveryService: DiscoveryService
    ) {}

    /**
     * Processes a block confirmation from an ANode and triggers broadcast if confirmation threshold is met.
     * @param blockHash - The hash of the block being confirmed
     * @param nodeId - The ID of the ANode confirming the block
     * @param blockData - The block data received from the ANode
     */
    async handleBlockConfirmation(blockHash: string, nodeId: string, blockData: FilterBlockResponse) {
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

        if (confirmation.nodes.size >= this.discoveryService.getMinArchiveNodes()) {
            await this.handleBlockConfirmed(blockHash, blockData);
        }
    }

    /**
     * Handles the logic when a block reaches the required number of confirmations.
     * Broadcasts the block update to connected clients and removes it from tracking.
     * @param blockHash - The hash of the confirmed block
     * @param blockData - The block data to broadcast
     * @private
     */
    private async handleBlockConfirmed(blockHash: string, blockData: FilterBlockResponse) {
        this.log.info(`Block ${blockHash} reached required confirmations`);
        this.wsServer.broadcastBlockUpdate(blockData);
        this.confirmations.delete(blockHash);
    }

    /**
     * Removes block confirmations that have exceeded the expiry time.
     * @private
     */
    private cleanupOldConfirmations() {
        const now = Date.now();
        for (const [blockHash, confirmation] of this.confirmations.entries()) {
            if (now - confirmation.timestamp > this.CONFIRMATION_EXPIRY_TIME) {
                this.confirmations.delete(blockHash);
                this.log.debug(`Cleaned up old confirmation for block ${blockHash}`);
            }
        }
    }
    
    /**
     * Initiates the cleanup of expired block confirmations.
     * Should be called periodically to prevent memory leaks.
     */
    public performCleanup() {
        this.cleanupOldConfirmations();
    }
}