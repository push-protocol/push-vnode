import WebSocket from 'ws';

// Message Types
export type MessageType = 
    | 'WELCOME' 
    | 'HANDSHAKE' 
    | 'HANDSHAKE_ACK'
    | 'SUBSCRIBE' 
    | 'SUBSCRIBE_ACK'
    | 'SUBSCRIBE_ERROR'
    | 'UNSUBSCRIBE'
    | 'UNSUBSCRIBE_ACK'
    | 'BLOCK'
    | 'PING' 
    | 'PONG' 
    | 'ERROR';

// Filter Types
export type FilterType = 'CATEGORY' | 'RECIPIENTS' | 'FROM';

// Core Data Interfaces
export interface FilteredTxData {
    blockHash: string;
    txHash: string;
    category: string;
    from: string;
    recipients: string[];
}

export interface FilterBlockResponse {
    blockHash: string;
    txs: FilteredTxData[];
}

export type SubscriptionFilter = {
    type: 'CATEGORY' | 'FROM' | 'RECIPIENTS' | 'WILDCARD';
    value: string[];
};

export interface Subscription {
    id: string;
    filters: SubscriptionFilter[];
}

// Client Related Interfaces
export interface ClientInfo {
    clientId: string;
}

export interface WSClientConnection {
    ws: WebSocket;
    subscriptions: Map<string, Subscription>;
    connectedAt: number;
    clientInfo?: ClientInfo;
    reconnectAttempts: number;
    lastSubscribeTime?: number;
}

// Message Interfaces
export interface BaseMessage {
    type: MessageType;
    timestamp: number;
}

export interface WelcomeMessage extends BaseMessage {
    type: 'WELCOME';
    data: {
        clientId: string;
    };
}

export interface HandshakeMessage extends BaseMessage {
    type: 'HANDSHAKE';
    data: ClientInfo;
}

export interface SubscribeMessage extends BaseMessage {
    type: 'SUBSCRIBE';
    filters: SubscriptionFilter[];
}

export interface BlockUpdateMessage extends BaseMessage {
    type: 'BLOCK';
    data: {
        block: FilterBlockResponse;
        subscriptionId: string;
        matchedFilter: SubscriptionFilter[];
    };
}

export interface BlockReceivedMessage extends BaseMessage {
    type: 'BLOCK';
    data: FilterBlockResponse;
}

export interface ErrorMessage extends BaseMessage {
    type: 'ERROR' | 'SUBSCRIBE_ERROR';
    data: {
        error: string;
        subscriptionId?: string;
        matchedFilter?: SubscriptionFilter[];
    };
}

export interface AckMessage extends BaseMessage {
    type: 'HANDSHAKE_ACK' | 'SUBSCRIBE_ACK' | 'UNSUBSCRIBE_ACK';
    data: {
        success: boolean;
        error?: string;
        subscriptionId?: string;
        filters?: SubscriptionFilter[];
    };
}

export interface UnsubscribeMessage extends BaseMessage {
    type: 'UNSUBSCRIBE';
    data: {
        subscriptionId: string;
    };
}

export interface PingMessage extends BaseMessage {
    type: 'PING';
}

export interface PongMessage extends BaseMessage {
    type: 'PONG';
    data: {
        success: boolean;
    };
}

export type WSMessage = 
    | WelcomeMessage 
    | HandshakeMessage 
    | SubscribeMessage 
    | BlockUpdateMessage 
    | BlockReceivedMessage
    | ErrorMessage 
    | AckMessage
    | UnsubscribeMessage
    | PingMessage
    | PongMessage;

// Configuration Interfaces
export interface DiscoveryConfig {
    refreshInterval: number;
    healthCheckTimeout: number;
    minArchiveNodes: number;
    maxRetries: number;
}

export interface BlockData {
    hash: string;
    number: number;
    timestamp: number;
    nodeId: string;
    nodeType: string;
}

export interface BlockConfirmation {
    timestamp: number;
    nodes: Set<string>;
}

export interface AuthResponse {
    type: 'AUTH_RESPONSE';
    nonce: string;
    signature: string;
    validatorAddress: string;
}