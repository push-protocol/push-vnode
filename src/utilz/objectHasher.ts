const hash = require('object-hash')

/**
 * Allows to build a consistent hash out of a json object
 */
export class ObjectHasher {
  private static options = {
    algorithm: 'sha256',
    encoding: 'hex',
    respectFunctionProperties: false, // skip functions
    respectFunctionNames: false, // skip function names
    respectType: false, // skip class info
    unorderedArrays: false, // don't sort arrays before hash
    unorderedSets: false, // don't sort sets before hash
    unorderedObjects: true // sort object properties before hash
  }

  // todo Object.assign(target, src)
  /**
   * Returns hex string
   * ex: de5ed3919975ece48c922a6380b59efc8638967ed236e0892164cc17ccfbf87b
   * @param obj json object
   */
  public static hashToSha256(obj: any): string {
    return hash(obj, ObjectHasher.options)
  }

  public static hashToSha256IgnoreSig(obj: any): string {
    return hash(obj, {
      ...ObjectHasher.options,
      excludeKeys: function (propName) {
        return 'signature' === propName
      }
    })
  }

  public static hashToSha256IgnoreRecipientsResolved(obj: any): string {
    return hash(obj, {
      ...ObjectHasher.options,
      excludeKeys: function (propName) {
        return 'recipientsResolved' === propName
      }
    })
  }
}
