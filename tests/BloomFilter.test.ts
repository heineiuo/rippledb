import BloomFilter from "../src/BloomFilter";
import Slice from "../src/Slice";
import { TextEncoder, TextDecoder } from "util";

// @ts-ignore make jest happy
global.TextEncoder = require("util").TextEncoder;

test("bloom filter", () => {
  const filter = new BloomFilter();
  expect(filter.bitBuffer.toString()).toBe("00000000");
  expect(filter.kNumber).toBe(7);

  const keys = [
    new Slice(new TextEncoder().encode("a")),
    new Slice(new TextEncoder().encode("a1")),
  ];

  filter.putKeys(keys, keys.length);

  expect(filter.bitBuffer.toString()).toBe(
    "000000000010101000100010001000100010000010000000000000101000000000001010",
  );

  const filter2Slice = new Slice(filter.buffer);
  const filter2 = new BloomFilter(filter.buffer);

  expect(
    filter2.keyMayMatch(new Slice(new TextEncoder().encode("a")), filter2Slice),
  ).toBe(true);
  expect(
    filter2.keyMayMatch(
      new Slice(new TextEncoder().encode("a1")),
      filter2Slice,
    ),
  ).toBe(true);
  expect(
    filter2.keyMayMatch(
      new Slice(new TextEncoder().encode("xxx")),
      filter2Slice,
    ),
  ).toBe(false);
});
