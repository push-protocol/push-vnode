export class BlockRangeHelper {
  fromBlockInclusive: number = 0
  toBlockInclusive: number = 0
  meta: object

  public constructor(fromBlockInclusive: number, toBlockInclusive: number, meta?: object) {
    this.fromBlockInclusive = fromBlockInclusive
    this.toBlockInclusive = toBlockInclusive
    this.meta = meta
  }

  public static splitBlockRangeIntoChunks(
    parentRange: BlockRangeHelper,
    maxChunkSize: number
  ): BlockRangeHelper[] {
    const arr: BlockRangeHelper[] = []

    if (
      maxChunkSize == 0 ||
      !parentRange ||
      parentRange.fromBlockInclusive == null ||
      parentRange.toBlockInclusive == null ||
      parentRange.toBlockInclusive < parentRange.fromBlockInclusive
    ) {
      return arr
    }
    if (maxChunkSize == 1 || parentRange.fromBlockInclusive == parentRange.toBlockInclusive) {
      arr.push(parentRange)
      return arr
    }

    let chunkEnd: number
    let start = parentRange.fromBlockInclusive
    const end = parentRange.toBlockInclusive
    while ((chunkEnd = start + maxChunkSize - 1) < end) {
      arr.push(new BlockRangeHelper(start, chunkEnd))
      start = chunkEnd + 1
    }
    arr.push(new BlockRangeHelper(start, end))
    return arr
  }

  public static toString(arr: BlockRangeHelper[]): string {
    return JSON.stringify(arr)
  }

  public static toStringObj(br: BlockRangeHelper): string {
    return `{ ${br.fromBlockInclusive}..${br.toBlockInclusive}  }`
  }
}
