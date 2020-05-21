import { Database } from "../port/node";
import { random } from "../fixtures/random";
import { createDir, cleanup } from "../fixtures/dbpath";
import { Buffer } from "../src/Buffer";

jest.setTimeout(60000 * 10);

// @ts-ignore make jest happy
global.TextEncoder = require("util").TextEncoder;

const dbpath = createDir();
const dbpath2 = createDir();
const dbpath3 = createDir();
afterAll(() => {
  cleanup(dbpath);
  cleanup(dbpath2);
  cleanup(dbpath3);
});

cleanup(dbpath);
cleanup(dbpath2);
cleanup(dbpath3);

describe("Database Iterator", () => {
  test("iterator with start option", async (done) => {
    const db = new Database(dbpath);
    let cacheKey = null;
    for (let i = 0; i < 1000; i++) {
      const entry = random();
      if (i === 500) cacheKey = entry[0];
      await db.put(entry[0], entry[1]);
    }

    let count = 0;
    let cacheKey2 = null;
    for await (const entry of db.iterator({ start: cacheKey })) {
      if (count === 0) {
        cacheKey2 = `${entry.key}`;
      }
      expect(
        Buffer.compare(
          Buffer.fromUnknown(String.fromCharCode.apply(null, entry.key)),
          Buffer.fromUnknown(cacheKey),
        ),
      ).toBe(1);
      count++;
      if (count > 10) break;
    }

    await db.del(cacheKey2);
    count = 0;

    for await (const entry of db.iterator({ start: cacheKey })) {
      expect(
        Buffer.compare(
          Buffer.fromUnknown(String.fromCharCode.apply(null, entry.key)),
          Buffer.fromUnknown(cacheKey2),
        ) !== 0,
      ).toBe(true);
      count++;
      if (count > 10) break;
    }
    await db.destroy();

    done();
  });

  test("iterator count", async (done) => {
    const db = new Database(dbpath2);
    const list = [];
    for (let i = 0; i < 500; i++) {
      list.push(random());
    }

    for (const entry of list) {
      await db.put(entry[0], entry[1]);
    }

    let count = 0;
    for await (const entry of db.iterator()) {
      if (entry) {
        count++;
      }
    }
    await db.destroy();

    expect(count).toBe(list.length);
    done();
  });

  test("reverse iterator", async (done) => {
    const db = new Database(dbpath3);
    const list = [];
    for (let i = 0; i < 10; i++) {
      list.push(random());
    }
    list.sort((a, b) =>
      Buffer.compare(Buffer.fromUnknown(a[0]), Buffer.fromUnknown(b[0])),
    );

    for (const entry of list) {
      await db.put(entry[0], entry[1]);
    }

    const listKeys = [];
    for await (const entry of db.iterator({ reverse: true })) {
      listKeys.push(String.fromCharCode.apply(null, entry.key));
    }

    const originalKeys = list
      .reverse()
      .map((pair) => pair[0])
      .join("|");

    expect(listKeys.join("|")).toEqual(originalKeys);
    await db.destroy();
    done();
  });
});
