import BloomFilter from "../src/BloomFilter";
import Slice from "../src/Slice";

test("bloom filter", () => {
  const filter = new BloomFilter();
  expect(filter.bitBuffer.toString()).toBe("00000000");
  expect(filter.kNumber).toBe(7);

  const keys = [new Slice("a"), new Slice("a1")];

  filter.putKeys(keys, keys.length);

  expect(filter.bitBuffer.toString()).toBe(
    "000000000010010010000010000000000010100100100010000000000010001001000010",
  );

  const filter2Slice = new Slice(filter.buffer);
  const filter2 = new BloomFilter(filter.buffer);

  expect(filter2.keyMayMatch(new Slice("a"), filter2Slice)).toBe(true);
  expect(filter2.keyMayMatch(new Slice("a1"), filter2Slice)).toBe(true);
  expect(filter2.keyMayMatch(new Slice("xxx"), filter2Slice)).toBe(false);
});
