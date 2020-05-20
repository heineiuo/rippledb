// source from npm/varint@5.0.0

import { Buffer } from "./buffer";

const MSB = 0x80;
const REST = 0x7f;
const MSBALL = ~REST;
const INT = Math.pow(2, 31);

const N1 = Math.pow(2, 7);
const N2 = Math.pow(2, 14);
const N3 = Math.pow(2, 21);
const N4 = Math.pow(2, 28);
const N5 = Math.pow(2, 35);
const N6 = Math.pow(2, 42);
const N7 = Math.pow(2, 49);
const N8 = Math.pow(2, 56);
const N9 = Math.pow(2, 63);

interface Encode {
  /**
   * Encodes `num` into `buffer` starting at `offset`. returns `buffer`, with the encoded varint written into it.
   * `varint.encode.bytes` will now be set to the number of bytes modified.
   */
  (num: number, buffer: Buffer, offset?: number): Buffer;

  /**
   * Encodes `num` into `array` starting at `offset`. returns `array`, with the encoded varint written into it.
   * If `array` is not provided, it will default to a new array.
   * `varint.encode.bytes` will now be set to the number of bytes modified.
   */
  (num: number, array?: number[], offset?: number): number[];

  bytes: number;
}

const encode: Encode = (num, out, offset?) => {
  out = out || [];
  offset = offset || 0;
  const oldOffset = offset;

  while (num >= INT) {
    out[offset++] = (num & 0xff) | MSB;
    num /= 128;
  }
  while (num & MSBALL) {
    out[offset++] = (num & 0xff) | MSB;
    num >>>= 7;
  }
  out[offset] = num | 0;

  encode.bytes = offset - oldOffset + 1;

  return out;
};

encode.bytes = 0;

function encodingLength(value: number): number {
  return value < N1
    ? 1
    : value < N2
    ? 2
    : value < N3
    ? 3
    : value < N4
    ? 4
    : value < N5
    ? 5
    : value < N6
    ? 6
    : value < N7
    ? 7
    : value < N8
    ? 8
    : value < N9
    ? 9
    : 10;
}

interface Decode {
  /**
   * Decodes `data`, which can be either a buffer or array of integers, from position `offset` or default 0 and returns the decoded original integer.
   * Throws a `RangeError` when `data` does not represent a valid encoding.
   */
  (buf: Buffer | number[], offset?: number): number;

  /**
   * If you also require the length (number of bytes) that were required to decode the integer you can access it via `varint.decode.bytes`.
   * This is an integer property that will tell you the number of bytes that the last .decode() call had to use to decode.
   */
  bytes: number;
}

const decode: Decode = (buf, offset) => {
  let res = 0;
  const offset2 = offset || 0;
  let shift = 0;
  let counter = offset2;
  let b: number;
  const l = buf.length;

  do {
    if (counter >= l) {
      decode.bytes = 0;
      throw new RangeError("Could not decode varint");
    }
    b = buf[counter++];
    res += shift < 28 ? (b & REST) << shift : (b & REST) * Math.pow(2, shift);
    shift += 7;
  } while (b >= MSB);

  decode.bytes = counter - offset2;

  return res;
};

decode.bytes = 0;

export default {
  decode,
  encode,
  encodingLength,
};
