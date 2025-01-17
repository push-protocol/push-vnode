import WebSocket from 'ws';

// src/services/WebSockets/types.ts
export interface BlockData {
    hash: string;
    number: number;
    timestamp: number;
    nodeId: string;
    nodeType: string;
    // ... other block data
}

export interface WSMessage {
    type: string;
    nodeId: string;      // ID of the subscriber (vNode)
    sourceNodeId?: string; // ID of the anode being subscribed to
    nodeType: string;
    events: string[];
    data?: any;
    timestamp?: number;
}

export interface ArchiveNodeInfo {
    id: string;
    wsUrl: string;
    status: 'ACTIVE' | 'INACTIVE';
    lastSeen?: number;
}

export interface ClientInfo {
    ws: WebSocket;
    subscriptions: Set<string>;
    connectedAt: number;
}

export interface ArchiveNodeInfo {
    id: string;
    wsUrl: string;
    status: 'ACTIVE' | 'INACTIVE';
    lastSeen?: number;
}

export interface DiscoveryConfig {
    refreshInterval: number;
    healthCheckTimeout: number;
    minArchiveNodes: number;
    maxRetries: number;
}