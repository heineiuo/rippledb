import BloomFilter from "../src/BloomFilter";
import Slice from "../src/Slice";

// @ts-ignore make jest happy
global.TextEncoder = require("util").TextEncoder;
// @ts-ignore make jest happy
global.TextDecoder = require("util").TextDecoder;

test("bloom filter", () => {
  const filter = new BloomFilter();
  expect(filter.bitBuffer.toString()).toBe("00000000");
  expect(filter.kNumber).toBe(7);

  const keys = [
    new Slice(new TextEncoder().encode("a")),
    new Slice(new TextEncoder().encode("a1")),
  ];

  filter.putKeys(keys, keys.length);

  const expectBits =
    "000010000010010011000000000000100001001000010000000000001000100100000100";
  expect(filter.bitBuffer.toString()).toBe(expectBits);

  const filter2Slice = new Slice(filter.buffer);
  const filter2 = new BloomFilter(filter.buffer);

  expect(filter2.keyMayMatch(keys[1], filter2Slice)).toBe(true);
  expect(filter2.keyMayMatch(keys[0], filter2Slice)).toBe(true);
  expect(
    filter2.keyMayMatch(
      new Slice(new TextEncoder().encode("xxx")),
      filter2Slice,
    ),
  ).toBe(false);
});
