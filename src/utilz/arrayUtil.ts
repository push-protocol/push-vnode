export class ArrayUtil {

  public static isEmpty<T>(arr: T[] | Uint8Array | null): boolean {
    if (arr == null) {
      return true;
    }
    if (typeof arr !== 'object') {
      return false;
    }
    return arr.length === 0
  }
}