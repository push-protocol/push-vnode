// noinspection JSUnusedGlobalSymbols

import {Service} from "typedi";

@Service()
export class BlockStatusService {

  async updateTxStatus(txHash: string, status: TxStatus): Promise<void> {

  }

  async updateBlockStatus(txHash: string, status: TxStatus): Promise<void> {

  }
}


export enum TxStatus {

  MEMPOOL = "MEMPOOL",
  VALIDATION = "VALIDATION",
  PUBLISHED = "PUBLISHED",

  INDEXED = "INDEXED",
  INDEXED_PARTIAL = "INDEXED_PARTIAL",
}

export enum BlockStatus {

  MEMPOOL = "MEMPOOL",
  VALIDATION = "VALIDATION",
  PUBLISHED = "PUBLISHED",

  INDEXED = "INDEXED",
  INDEXED_PARTIAL = "INDEXED_PARTIAL",
}