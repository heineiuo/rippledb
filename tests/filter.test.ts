import MurmurHash from "../src/MurmurHash";

test("filter", () => {
  const seed1 = Math.floor(Math.random() * 2e32);
  expect(MurmurHash("kadff", 1) % 15).toBe(2);
  expect(MurmurHash("kadff", 23) % 15).toBe(6);
  expect(MurmurHash("kadff", 44) % 15).toBe(2);
  expect(MurmurHash("adf132", seed1) % 15).toBe(4);
  expect(MurmurHash("afdjkalg", seed1) % 15).toBe(6);
  expect(MurmurHash("kakldf", seed1) % 15).toBe(10);
});
