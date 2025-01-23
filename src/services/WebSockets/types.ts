import WebSocket from 'ws';

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

export interface DiscoveryConfig {
    refreshInterval: number;
    healthCheckTimeout: number;
    minArchiveNodes: number;
    maxRetries: number;
}

export interface AuthResponse {
    type: 'AUTH_RESPONSE';
    nonce: string;
    signature: string;
    validatorAddress: string;
}

export interface WSMessage {
    type: string;
    data?: any;
    timestamp: number;
}

export interface ClientInfo {
    clientId: string;
    producerAddress: string;
}

export interface WSClientConnection {
    ws: WebSocket;
    subscriptions: Map<string, Subscription>; // subscriptionId -> Subscription
    connectedAt: number;
    clientInfo?: ClientInfo;
    reconnectAttempts?: number;
    lastSubscribeTime?: number;
}

export type FilterType = 'NEW_BLOCK' | 'CATEGORY' | 'SELF' | 'SENDERS' | 'RECEIVERS';

export interface BaseFilter {
    type: FilterType;
}

export interface BlockStoredFilter extends BaseFilter {
    type: 'NEW_BLOCK';
}

export interface CategoryFilter extends BaseFilter {
    type: 'CATEGORY';
    value: string;  // Required string for category name
}

export interface SelfFilter extends BaseFilter {
    type: 'SELF';
}

export interface SendersFilter extends BaseFilter {
    type: 'SENDERS';
    value: string[];  // Required array of sender addresses
}

export interface ReceiversFilter extends BaseFilter {
    type: 'RECEIVERS';
    value: string[];  // Required array of receiver addresses
}

export type SubscriptionFilter = {
    type: FilterType;
    value?: string | string[];
};

export interface Subscription {
    id: string;
    filters: SubscriptionFilter[];
}

export interface SubscribeMessage {
    filters: SubscriptionFilter[];
}

export interface Transaction {
    producerAddress: string;
}