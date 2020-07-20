import Slice from "../src/Slice";
import MemTable from "../src/MemTable";
import { LookupKey, ValueType, InternalKeyComparator } from "../src/Format";
import { BytewiseComparator } from "../src/Comparator";
// @ts-ignore make jest happy
global.TextEncoder = require("util").TextEncoder;
// @ts-ignore make jest happy
global.TextDecoder = require("util").TextDecoder;

test("memtable add and get", () => {
  const memtable = new MemTable(
    new InternalKeyComparator(new BytewiseComparator()),
  );
  memtable.add(
    10n,
    ValueType.kTypeValue,
    new Slice("key"),
    new Slice("key1valuevalue1"),
  );
  memtable.add(
    20n,
    ValueType.kTypeValue,
    new Slice("key2"),
    new Slice("key2valuevadfa"),
  );
  memtable.add(
    30n,
    ValueType.kTypeValue,
    new Slice("key3"),
    new Slice("key3value12389fdajj123"),
  );

  expect(!!memtable.get(new LookupKey(new Slice("key"), 1000n))).toBe(true);

  expect(!!memtable.get(new LookupKey(new Slice("key3"), 5n))).toBe(false);
});

test("memtable reverse iterator", () => {
  const memtable = new MemTable(
    new InternalKeyComparator(new BytewiseComparator()),
  );
  memtable.add(
    10n,
    ValueType.kTypeValue,
    new Slice("key"),
    new Slice("key1valuevalue1"),
  );
  memtable.add(
    20n,
    ValueType.kTypeValue,
    new Slice("key2"),
    new Slice("key2valuevadfa"),
  );
  memtable.add(
    30n,
    ValueType.kTypeValue,
    new Slice("key3"),
    new Slice("key3value12389fdajj123"),
  );

  const result = [];

  for (const entry of memtable.iterator(true)) {
    result.push(new TextDecoder().decode(entry.value.buffer));
  }

  expect(result).toStrictEqual([
    "key3value12389fdajj123",
    "key2valuevadfa",
    "key1valuevalue1",
  ]);
});
