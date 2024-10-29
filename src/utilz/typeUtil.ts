export class TypeUtil {
  static isStringArray(obj: any): boolean {
    return obj!=null && Array.isArray(obj) && obj.every(element => typeof element === 'string')
  }

  static isAnyArray(obj: any): boolean {
    return obj!=null && Array.isArray(obj)
  }
}