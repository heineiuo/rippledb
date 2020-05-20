import { Buffer } from "./Buffer";

function pathResolve(...pathes: string[]): string {
  return pathes.join("/");
}

export const path = {
  resolve: pathResolve,
};

export function assert(bool: boolean, message?: string): void {
  try {
    if (!bool) {
      throw new Error();
    }
  } catch (e) {
    throw new Error(`AssertError: ${message || e.stack[0]}`);
  }
}

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
  (num: number, out?: number[], offset?: number): number[];
  bytes: number;
}

const encode: Encode = (num: number, out?: number[], offset?: number) => {
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
  (buf: Buffer, offset?: number): number;
  bytes: number;
}

const decode: Decode = (buf: Buffer, offset?: number) => {
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

export const varint = {
  decode,
  encode,
  encodingLength,
};
