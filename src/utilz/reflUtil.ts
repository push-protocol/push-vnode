export class ReflUtil {

  static getMethodNames(obj: any,
                        searchObjProperties:boolean = true,
                        searchObjProto:boolean = true,
                        searchObjProtoHierarchy: boolean = false): Set<string> {
    const methodNames = new Set<string>();

    // Collect own property method names
    if (searchObjProperties) {
      for (const key of Object.getOwnPropertyNames(obj)) {
        if (typeof (obj as any)[key] === 'function') {
          methodNames.add(key);
        }
      }
    }

    if (searchObjProto) {
      // Collect prototype method names
      let proto = Object.getPrototypeOf(obj);
      while (proto && proto !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(proto)) {
          if (typeof proto[key] === 'function' && key !== 'constructor') {
            methodNames.add(key);
          }
        }
        if(searchObjProtoHierarchy) {
          proto = Object.getPrototypeOf(proto);
        } else {
          proto = null;
        }
      }
    }

    return methodNames;
  }
}