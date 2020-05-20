const revLookup: number[] = [];

export class Buffer extends Uint8Array {
  // ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
  // the `instanceof` check but they should be treated as of that type.
  // See: https://github.com/feross/buffer/issues/166
  static isInstance(obj: any, type: any): boolean {
    return (
      obj instanceof type ||
      (obj != null &&
        obj.constructor != null &&
        obj.constructor.name != null &&
        obj.constructor.name === type.name)
    );
  }

  static kMaxLength = 0x7fffffff;

  static checkInt(
    buf: Buffer,
    value: number,
    offset: number,
    ext: number,
    max: number,
    min: number,
  ): void {
    if (!Buffer.isBuffer(buf))
      throw new TypeError('"buffer" argument must be a Buffer instance');
    if (value > max || value < min)
      throw new RangeError('"value" argument is out of bounds');
    if (offset + ext > buf.length) throw new RangeError("Index out of range");
  }

  static checkBigInt(
    value: bigint,
    min: bigint,
    max: bigint,
    buf: Buffer,
    offset: number,
    byteLength: number,
  ): void {
    if (value > max || value < min) {
      const n = typeof min === "bigint" ? "n" : "";
      let range = "";
      if (byteLength > 3) {
        if (min === 0n) {
          range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`;
        } else {
          range =
            `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and < 2 ** ` +
            `${(byteLength + 1) * 8 - 1}${n}`;
        }
      } else {
        range = `>= ${min}${n} and <= ${max}${n}`;
      }
      throw new RangeError(range);
    }
    if (buf[offset] === undefined || buf[offset + byteLength] === undefined) {
      throw new RangeError("Invalid buffer or offset for BigInt");
    }
  }

  static checkOffset(offset: number, ext: number, length: number): void {
    if (offset % 1 !== 0 || offset < 0)
      throw new RangeError("offset is not uint");
    if (offset + ext > length)
      throw new RangeError("Trying to access beyond buffer length");
  }

  static createBuffer(length: number): Buffer {
    if (length > Buffer.kMaxLength) {
      throw new RangeError(
        'The value "' + length + '" is invalid for option "size"',
      );
    }
    // Return an augmented `Uint8Array` instance
    return new Buffer(length);
  }

  static isBuffer(obj: any): obj is Buffer {
    // so Buffer.isBuffer(Buffer.prototype) will be false
    return obj != null && obj._isBuffer === true && obj !== Buffer.prototype;
  }

  static byteLength(
    string: ArrayBuffer | Buffer | string,
    encoding?: string,
    mustMatch?: boolean,
  ): number {
    if (Buffer.isBuffer(string)) {
      return string.length;
    }

    if (ArrayBuffer.isView(string)) {
      return string.byteLength;
    }
    if (typeof string !== "string") {
      throw new TypeError(
        'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
          "Received type " +
          typeof string,
      );
    }

    const len = string.length;
    if (!mustMatch && len === 0) return 0;

    // Use a for loop to avoid recursion
    let loweredCase = false;
    for (;;) {
      switch (encoding) {
        case "ascii":
        case "latin1":
        case "binary":
          return len;
        case "utf8":
        case "utf-8":
          return Buffer.utf8ToBytes(string).length;
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return len * 2;
        case "hex":
          return len >>> 1;
        case "base64":
          return Buffer.base64ToBytes(string).length;
        default:
          if (loweredCase) {
            return mustMatch ? -1 : Buffer.utf8ToBytes(string).length; // assume utf8
          }
          encoding = ("" + encoding).toLowerCase();
          loweredCase = true;
      }
    }
  }

  static INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

  static base64clean(str: string): string {
    // Node takes equal signs as end of the Base64 encoding
    str = str.split("=")[0];
    // Node strips out invalid characters like \n and \t from the string, base64-js does not
    str = str.trim().replace(Buffer.INVALID_BASE64_RE, "");
    // Node converts strings with length < 2 to ''
    if (str.length < 2) return "";
    // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
    while (str.length % 4 !== 0) {
      str = str + "=";
    }
    return str;
  }

  static getLens(b64: string): [number, number] {
    const len = b64.length;

    if (len % 4 > 0) {
      throw new Error("Invalid string. Length must be a multiple of 4");
    }

    // Trim off extra bytes after placeholder bytes are found
    // See: https://github.com/beatgammit/base64-js/issues/42
    let validLen = b64.indexOf("=");
    if (validLen === -1) validLen = len;

    const placeHoldersLen = validLen === len ? 0 : 4 - (validLen % 4);

    return [validLen, placeHoldersLen];
  }

  static base64ToBytes(str: string): Uint8Array {
    const b64 = Buffer.base64clean(str);

    let tmp;
    const lens = Buffer.getLens(b64);
    const validLen = lens[0];
    const placeHoldersLen = lens[1];

    const b64ByteLength =
      ((validLen + placeHoldersLen) * 3) / 4 - placeHoldersLen;

    const arr = new Uint8Array(b64ByteLength);

    let curByte = 0;

    // if there are placeholders, only get up to the last complete 4 chars
    const len = placeHoldersLen > 0 ? validLen - 4 : validLen;

    let i;
    for (i = 0; i < len; i += 4) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 18) |
        (revLookup[b64.charCodeAt(i + 1)] << 12) |
        (revLookup[b64.charCodeAt(i + 2)] << 6) |
        revLookup[b64.charCodeAt(i + 3)];
      arr[curByte++] = (tmp >> 16) & 0xff;
      arr[curByte++] = (tmp >> 8) & 0xff;
      arr[curByte++] = tmp & 0xff;
    }

    if (placeHoldersLen === 2) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 2) |
        (revLookup[b64.charCodeAt(i + 1)] >> 4);
      arr[curByte++] = tmp & 0xff;
    }

    if (placeHoldersLen === 1) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 10) |
        (revLookup[b64.charCodeAt(i + 1)] << 4) |
        (revLookup[b64.charCodeAt(i + 2)] >> 2);
      arr[curByte++] = (tmp >> 8) & 0xff;
      arr[curByte++] = tmp & 0xff;
    }

    return arr;
  }

  static utf8ToBytes(string: string, units?: number): number[] {
    units = units || Infinity;
    let codePoint;
    const length = string.length;
    let leadSurrogate = null;
    const bytes = [];

    for (let i = 0; i < length; ++i) {
      codePoint = string.charCodeAt(i);

      // is surrogate component
      if (codePoint > 0xd7ff && codePoint < 0xe000) {
        // last char was a lead
        if (!leadSurrogate) {
          // no lead yet
          if (codePoint > 0xdbff) {
            // unexpected trail
            if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
            continue;
          } else if (i + 1 === length) {
            // unpaired lead
            if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
            continue;
          }

          // valid lead
          leadSurrogate = codePoint;

          continue;
        }

        // 2 leads in a row
        if (codePoint < 0xdc00) {
          if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
          leadSurrogate = codePoint;
          continue;
        }

        // valid surrogate pair
        codePoint =
          (((leadSurrogate - 0xd800) << 10) | (codePoint - 0xdc00)) + 0x10000;
      } else if (leadSurrogate) {
        // valid bmp char, but last char was a lead
        if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
      }

      leadSurrogate = null;

      // encode utf8
      if (codePoint < 0x80) {
        if ((units -= 1) < 0) break;
        bytes.push(codePoint);
      } else if (codePoint < 0x800) {
        if ((units -= 2) < 0) break;
        bytes.push((codePoint >> 0x6) | 0xc0, (codePoint & 0x3f) | 0x80);
      } else if (codePoint < 0x10000) {
        if ((units -= 3) < 0) break;
        bytes.push(
          (codePoint >> 0xc) | 0xe0,
          ((codePoint >> 0x6) & 0x3f) | 0x80,
          (codePoint & 0x3f) | 0x80,
        );
      } else if (codePoint < 0x110000) {
        if ((units -= 4) < 0) break;
        bytes.push(
          (codePoint >> 0x12) | 0xf0,
          ((codePoint >> 0xc) & 0x3f) | 0x80,
          ((codePoint >> 0x6) & 0x3f) | 0x80,
          (codePoint & 0x3f) | 0x80,
        );
      } else {
        throw new Error("Invalid code point");
      }
    }

    return bytes;
  }

  static isEncoding(encoding: string): boolean {
    switch (String(encoding).toLowerCase()) {
      case "hex":
      case "utf8":
      case "utf-8":
      case "ascii":
      case "latin1":
      case "binary":
      case "base64":
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return true;
      default:
        return false;
    }
  }

  static checked(length: number): number {
    // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
    // length is NaN (which is otherwise coerced to zero.)
    if (length >= Buffer.kMaxLength) {
      throw new RangeError(
        "Attempt to allocate Buffer larger than maximum " +
          "size: 0x" +
          Buffer.kMaxLength.toString(16) +
          " bytes",
      );
    }
    return length | 0;
  }

  static fromArrayLike(arr: number[]): Buffer {
    const length = arr.length < 0 ? 0 : Buffer.checked(arr.length) | 0;
    const buf = Buffer.createBuffer(length);
    for (let i = 0; i < length; i += 1) {
      buf[i] = arr[i] & 255;
    }
    return buf;
  }

  static fromArrayBuffer(
    array: ArrayBuffer,
    byteOffset: number,
    length?: number,
  ): Buffer {
    if (byteOffset < 0 || array.byteLength < byteOffset) {
      throw new RangeError('"offset" is outside of buffer bounds');
    }

    if (array.byteLength < byteOffset + (length || 0)) {
      throw new RangeError('"length" is outside of buffer bounds');
    }

    let buf;
    if (byteOffset === undefined && length === undefined) {
      buf = new Uint8Array(array);
    } else if (length === undefined) {
      buf = new Uint8Array(array, byteOffset);
    } else {
      buf = new Uint8Array(array, byteOffset, length);
    }

    return new Buffer(buf);
  }

  static isArrayBuffer(value: any): value is ArrayBuffer {
    return (
      value instanceof ArrayBuffer ||
      toString.call(value) === "[object ArrayBuffer]"
    );
  }

  static assertSize(size: number): void {
    if (typeof size !== "number") {
      throw new TypeError('"size" argument must be of type number');
    } else if (size < 0) {
      throw new RangeError(
        'The value "' + size + '" is invalid for option "size"',
      );
    }
  }

  static alloc(size: number): Buffer {
    Buffer.assertSize(size);
    if (size <= 0) {
      return Buffer.createBuffer(size);
    }
    return Buffer.createBuffer(size);
  }

  static allocUnsafe(size: number): Buffer {
    Buffer.assertSize(size);
    return Buffer.createBuffer(size < 0 ? 0 : Buffer.checked(size) | 0);
  }

  concat(list: Buffer[], length?: number): Buffer {
    if (!Array.isArray(list)) {
      throw new TypeError('"list" argument must be an Array of Buffers');
    }

    if (list.length === 0) {
      return Buffer.alloc(0);
    }

    let i;
    if (length === undefined) {
      length = 0;
      for (i = 0; i < list.length; ++i) {
        length += list[i].length;
      }
    }

    const buffer = Buffer.allocUnsafe(length);
    let pos = 0;
    for (i = 0; i < list.length; ++i) {
      const buf = list[i];
      if (!Buffer.isBuffer(buf)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
      }
      buf.copy(buffer, pos);
      pos += buf.length;
    }
    return buffer;
  }

  copy(
    target: Buffer,
    targetStart?: number,
    start?: number,
    end?: number,
  ): number {
    if (!Buffer.isBuffer(target))
      throw new TypeError("argument should be a Buffer");
    if (!start) start = 0;
    if (!end && end !== 0) end = this.length;
    if (!targetStart) targetStart = 0;
    if (targetStart >= target.length) targetStart = target.length;
    if (end > 0 && end < start) end = start;

    // Copy 0 bytes; we're done
    if (end === start) return 0;
    if (target.length === 0 || this.length === 0) return 0;

    // Fatal error conditions
    if (targetStart < 0) {
      throw new RangeError("targetStart out of bounds");
    }
    if (start < 0 || start >= this.length)
      throw new RangeError("Index out of range");
    if (end < 0) throw new RangeError("sourceEnd out of bounds");

    // Are we oob?
    if (end > this.length) end = this.length;
    if (target.length - targetStart < end - start) {
      end = target.length - targetStart + start;
    }

    const len = end - start;

    if (
      this === target &&
      typeof Uint8Array.prototype.copyWithin === "function"
    ) {
      // Use built-in when available, missing from IE11
      this.copyWithin(targetStart, start, end);
    } else if (this === target && start < targetStart && targetStart < end) {
      // descending copy from end
      for (let i = len - 1; i >= 0; --i) {
        target[i + targetStart] = this[i + start];
      }
    } else {
      Uint8Array.prototype.set.call(
        target,
        this.subarray(start, end),
        targetStart,
      );
    }

    return len;
  }

  slice(start = 0, end?: number): Buffer {
    const len = this.length;
    start = ~~start;
    end = end === undefined ? len : ~~end;

    if (start < 0) {
      start += len;
      if (start < 0) start = 0;
    } else if (start > len) {
      start = len;
    }

    if (end < 0) {
      end += len;
      if (end < 0) end = 0;
    } else if (end > len) {
      end = len;
    }

    if (end < start) end = start;

    return new Buffer(this.subarray(start, end));
  }

  readUInt8(offset = 0, noAssert = false): number {
    offset = offset >>> 0;
    if (!noAssert) Buffer.checkOffset(offset, 1, this.length);
    return this[offset];
  }

  readUInt16BE(offset = 0, noAssert = false): number {
    offset = offset >>> 0;
    if (!noAssert) Buffer.checkOffset(offset, 2, this.length);
    return (this[offset] << 8) | this[offset + 1];
  }

  readUInt32BE(offset = 0, noAssert = false): number {
    offset = offset >>> 0;
    if (!noAssert) Buffer.checkOffset(offset, 4, this.length);

    return (
      this[offset] * 0x1000000 +
      ((this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3])
    );
  }

  readUInt32LE(offset = 0, noAssert = false): number {
    offset = offset >>> 0;
    if (!noAssert) Buffer.checkOffset(offset, 4, this.length);

    return (
      (this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16)) +
      this[offset + 3] * 0x1000000
    );
  }

  readBigUInt64LE(offset = 0): bigint {
    const first = this[offset];
    const last = this[offset + 7];
    if (first === undefined || last === undefined) {
      throw new RangeError("Invalid offset or buffer to readBigUInt64LE");
    }

    const lo =
      first +
      this[++offset] * 2 ** 8 +
      this[++offset] * 2 ** 16 +
      this[++offset] * 2 ** 24;

    const hi =
      this[++offset] +
      this[++offset] * 2 ** 8 +
      this[++offset] * 2 ** 16 +
      last * 2 ** 24;

    return BigInt(lo) + (BigInt(hi) << 32n);
  }

  readBigInt64LE(offset = 0): bigint {
    const first = this[offset];
    const last = this[offset + 7];
    if (first === undefined || last === undefined) {
      throw new RangeError("Invalid offset or buffer to readBigInt64LE");
    }

    const val =
      this[offset + 4] +
      this[offset + 5] * 2 ** 8 +
      this[offset + 6] * 2 ** 16 +
      (last << 24); // Overflow

    return (
      (BigInt(val) << 32n) +
      BigInt(
        first +
          this[++offset] * 2 ** 8 +
          this[++offset] * 2 ** 16 +
          this[++offset] * 2 ** 24,
      )
    );
  }

  writeUInt32LE(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;
    if (!noAssert) Buffer.checkInt(this, value, offset, 4, 0xffffffff, 0);
    this[offset + 3] = value >>> 24;
    this[offset + 2] = value >>> 16;
    this[offset + 1] = value >>> 8;
    this[offset] = value & 0xff;
    return offset + 4;
  }

  writeInt32BE(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;
    if (!noAssert)
      Buffer.checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    if (value < 0) value = 0xffffffff + value + 1;
    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 0xff;
    return offset + 4;
  }

  writeBigUInt64LE(value: bigint, offset = 0): number {
    return this.internalWriteBigUInt64LE(
      this,
      value,
      offset,
      0n,
      0xffffffffffffffffn,
    );
  }

  private internalWriteBigUInt64LE(
    buf: Buffer,
    value: bigint,
    offset: number,
    min: bigint,
    max: bigint,
  ): number {
    Buffer.checkBigInt(value, min, max, buf, offset, 7);

    let lo = Number(value & 0xffffffffn);
    buf[offset++] = lo;
    lo = lo >> 8;
    buf[offset++] = lo;
    lo = lo >> 8;
    buf[offset++] = lo;
    lo = lo >> 8;
    buf[offset++] = lo;
    let hi = Number((value >> 32n) & 0xffffffffn);
    buf[offset++] = hi;
    hi = hi >> 8;
    buf[offset++] = hi;
    hi = hi >> 8;
    buf[offset++] = hi;
    hi = hi >> 8;
    buf[offset++] = hi;
    return offset;
  }
}

function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  const bufView = new Uint16Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

export function bufferFrom(
  value: string | Uint8Array | Buffer | ArrayBuffer | { length: number },
  encodingOrOffset?: number | string,
  length?: number,
): Buffer {
  if (Buffer.isBuffer(value)) return value;

  if (typeof value === "string") {
    return Buffer.fromArrayBuffer(str2ab(value), 0);
  }

  if (Array.isArray(value)) {
    return Buffer.fromArrayLike(value);
  }

  if (Buffer.isArrayBuffer(value)) {
    if (typeof encodingOrOffset === "number") {
      return Buffer.fromArrayBuffer(value, encodingOrOffset, length);
    } else {
      return Buffer.fromArrayBuffer(value, 0);
    }
  }

  if (typeof value.length === "number") {
    return Buffer.createBuffer(value.length);
  }

  throw new TypeError(
    "The first argument must be one of type string, Buffer, ArrayBuffer, Array. Received type " +
      typeof value,
  );
}
