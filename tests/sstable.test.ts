import fs from "fs";
import Slice from "../src/Slice";
import SSTable from "../src/SSTable";
import SSTableBuilder from "../src/SSTableBuilder";
import { getTableFilename } from "../src/Filename";
import { createDir, cleanup } from "../fixtures/dbpath";
import { random } from "../fixtures/random";
import { InternalKey, SequenceNumber, ValueType } from "../src/Format";
import { defaultOptions } from "../src/Options";
import { NodeEnv } from "../port/node";

const dbpath = createDir();
afterAll(() => cleanup(dbpath));

cleanup(dbpath);

const options = { ...defaultOptions, env: new NodeEnv() };

test("sstable", async () => {
  await fs.promises.mkdir(dbpath, { recursive: true });
  const fd1 = await fs.promises.open(getTableFilename(dbpath, 1), "w");
  const builder = new SSTableBuilder(options, fd1);

  const count = 1000;
  let i = 0;
  const list = [];
  while (i < count) {
    list.push(random());
    i++;
  }
  i = 0;
  list.sort((a, b) =>
    Buffer.from(a[0]).compare(Buffer.from(b[0])) < 0 ? -1 : 1,
  );

  while (i < count) {
    const [key, value] = list[i];
    const ikey = new InternalKey(
      new Slice(key),
      new SequenceNumber(i),
      ValueType.kTypeValue,
    );
    await builder.add(ikey, new Slice(value));
    i++;
  }

  await builder.finish();

  const fd = await fs.promises.open(getTableFilename(dbpath, 1), "r+");
  const table = await SSTable.open(options, fd);

  const listKeys = [];
  const listValues = [];
  for await (const entry of table.entryIterator()) {
    const ikey = InternalKey.from(entry.key);
    listKeys.push(ikey.userKey.toString());
    listValues.push(entry.value.toString());
  }

  expect(list.map((pair) => pair[0]).join("|")).toEqual(listKeys.join("|"));
  expect(list.map((pair) => pair[1]).join("|")).toEqual(listValues.join("|"));
});

test("sstable reverse iterator", async () => {
  await fs.promises.mkdir(dbpath, { recursive: true });
  const fd1 = await fs.promises.open(getTableFilename(dbpath, 2), "w");
  const builder = new SSTableBuilder(options, fd1);

  const count = 100;
  let i = 0;
  const list = [];
  while (i < count) {
    list.push(random());
    i++;
  }
  i = 0;
  list.sort((a, b) =>
    Buffer.from(a[0]).compare(Buffer.from(b[0])) < 0 ? -1 : 1,
  );

  while (i < count) {
    const [key, value] = list[i];
    const ikey = new InternalKey(
      new Slice(key),
      new SequenceNumber(i),
      ValueType.kTypeValue,
    );
    await builder.add(ikey, new Slice(value));
    i++;
  }

  await builder.finish();

  const fd = await fs.promises.open(getTableFilename(dbpath, 2), "r+");
  const table = await SSTable.open(options, fd);

  const listKeys = [];
  const listValues = [];
  for await (const entry of table.entryIterator(true)) {
    const ikey = InternalKey.from(entry.key);
    listKeys.push(ikey.userKey.toString());
    listValues.push(entry.value.toString());
  }

  const original = list
    .reverse()
    .map((pair) => pair[1])
    .join("|");

  // console.log(original)
  // console.log(listValues.join('|'))
  expect(listValues.join("|")).toEqual(original);
});
