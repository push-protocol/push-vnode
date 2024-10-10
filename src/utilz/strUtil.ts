import {BitUtil} from "./bitUtil";

export default class StrUtil {

    public static isEmpty(s: string): boolean {
        if (s == null) {
            return true;
        }
        if (typeof s !== 'string') {
            return false;
        }
        return s.length === 0
    }

    public static hasSize(s: string, minSize: number | null, maxSize: number | null): boolean {
        if (s == null || typeof s !== 'string') {
            return false;
        }
        const length = s.length;
        if (minSize !== null && length < minSize) {
            return false;
        }
        if (maxSize !== null && length > maxSize) {
            return false;
        }
        return true;
    }

    public static isHex(s: string): boolean {
        if (StrUtil.isEmpty(s)) {
            return false;
        }
        let pattern = /^[A-F0-9]+$/i;
        let result = pattern.test(s);
        return result;
    }

    /**
     * Return s if this is not empty, defaultValue otherwise
     * @param s
     * @param defaultValue
     */
    public static getOrDefault(s: string, defaultValue: string) {
        return StrUtil.isEmpty(s) ? defaultValue : s;
    }

    public static toStringDeep(obj: any): string {
        return JSON.stringify(obj, null, 4);
    }

    // https://ethereum.stackexchange.com/questions/2045/is-ethereum-wallet-address-case-sensitive
    public static normalizeEthAddress(addr: string): string {
        return addr;
    }

    public static fmtProtoBytes(obj: any): string {
        if (typeof obj.serializeBinary === 'function') {
            const result = obj.serializeBinary();
            if (result instanceof Uint8Array) {
                return BitUtil.bytesToBase16(obj.serializeBinary());
            }
        }
    }

    public static fmtProtoObj(obj:any): string {
        if (typeof obj.toObject === 'function') {
            const result = obj.serializeBinary();
            if (result instanceof Uint8Array) {
                return JSON.stringify(obj.toObject(), null, 4);
            }
        }
    }

    public static fmt(obj:any): string {
        if(obj instanceof Uint8Array) {
            // byte array
            return BitUtil.bytesToBase16(obj);
        }
        if(obj instanceof Buffer) {
            return obj.toString('hex');
        }
        if (typeof obj.serializeBinary === 'function') {
            const result = obj.serializeBinary();
            if (result instanceof Uint8Array) {
                return StrUtil.fmtProtoObj(obj);
            }
        }
        if(Array.isArray(obj) && obj.every((elem) => typeof elem === 'string')) {
            // string[]
            return JSON.stringify(obj); // todo doesn't work
        }
        if(obj instanceof Set && (Array.from(obj).every((elem) => typeof elem === 'string'))) {
            // Set<string>
            return JSON.stringify(obj);
        }
        return JSON.stringify(obj);
    }
}