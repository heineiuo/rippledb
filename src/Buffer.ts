export class Buffer extends Uint8Array {
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

  static isBuffer(obj: unknown): obj is Buffer {
    return obj instanceof Buffer;
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

  static fromString(str: string): Buffer {
    const ab = new TextEncoder().encode(str);
    return Buffer.fromArrayBuffer(ab);
  }

  static fromHex(hexString: string): Buffer {
    const len = Math.floor(hexString.length / 2);
    const buf = Buffer.alloc(len);
    for (let i = 0; i < len; ++i) {
      const parsed = parseInt(hexString.substr(i * 2, 2), 16);
      if (isNaN(parsed)) return buf;
      buf[i] = parsed;
    }

    return buf;
  }

  static fromArrayBuffer(array: ArrayBuffer): Buffer {
    return new Buffer(array);
  }

  static fromUnknown(
    value: string | Uint8Array | Buffer | ArrayBuffer | { length: number },
  ): Buffer {
    if (Buffer.isBuffer(value)) return value;

    if (typeof value === "string") {
      return Buffer.fromString(value);
    }

    if (Array.isArray(value)) {
      return Buffer.fromArrayLike(value);
    }

    if (Buffer.isArrayBuffer(value)) {
      return Buffer.fromArrayBuffer(value);
    }

    if (typeof value.length === "number") {
      return Buffer.createBuffer(value.length);
    }

    throw new TypeError(
      "The first argument must be one of type string, Buffer, ArrayBuffer, Array. Received type " +
        typeof value,
    );
  }

  // a<b: -1
  static compare(a: Buffer, b: Buffer): 0 | -1 | 1 {
    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
      throw new TypeError(
        'The "a", "b" arguments must be one of type Buffer or Uint8Array',
      );
    }

    if (a === b) return 0;

    let x = a.length;
    let y = b.length;

    for (let i = 0, len = Math.min(x, y); i < len; ++i) {
      if (a[i] !== b[i]) {
        x = a[i];
        y = b[i];
        break;
      }
    }

    if (x < y) return -1;
    if (y < x) return 1;
    return 0;
  }

  static isArrayBuffer(value: unknown): value is ArrayBuffer {
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

  static concat(list: Buffer[], length?: number): Buffer {
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

  fillBuffer(val: Buffer, start = 0, end?: number): Buffer {
    end = end || this.length;
    if (start < 0 || this.length < start || this.length < end) {
      throw new RangeError("Out of range index");
    }

    if (end <= start) {
      return this;
    }

    start = start >>> 0;
    end = end === undefined ? this.length : end >>> 0;

    const len = val.length;
    if (len === 0) {
      throw new TypeError(
        'The value "' + val + '" is invalid for argument "value"',
      );
    }

    for (let i = 0; i < end - start; ++i) {
      this[i + start] = val[i % len];
    }

    return this;
  }

  fillInt(val: number, start = 0, end?: number): Buffer {
    val = val & 255;
    end = end || this.length;

    if (start < 0 || this.length < start || this.length < end) {
      throw new RangeError("Out of range index");
    }

    if (end <= start) {
      return this;
    }

    start = start >>> 0;
    end = end === undefined ? this.length : end >>> 0;

    if (!val) val = 0;

    if (typeof val === "number") {
      for (let i = start; i < end; ++i) {
        this[i] = val;
      }
    }

    return this;
  }

  slice(start = 0, end?: number): Buffer {
    const len = this.length;
    start = ~~start;
    end = typeof end === "undefined" ? len : ~~end;

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

    return Buffer.fromArrayBuffer(this.subarray(start, end));
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
