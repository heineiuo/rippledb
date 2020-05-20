import { Database } from "../port/node";
import { random } from "../fixtures/random";
import { createDir, cleanup } from "../fixtures/dbpath";
import { Buffer } from "../src/Buffer";

jest.setTimeout(60000 * 10);

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
          Buffer.bufferFrom(String.fromCharCode.apply(null, entry.key)),
          Buffer.bufferFrom(cacheKey),
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
          Buffer.bufferFrom(String.fromCharCode.apply(null, entry.key)),
          Buffer.bufferFrom(cacheKey2),
        ) !== 0,
      ).toBe(true);
      count++;
      if (count > 10) break;
    }
    done();
  });

  test("iterator count", async () => {
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

    expect(count).toBe(list.length);
  });

  test("reverse iterator", async () => {
    const db = new Database(dbpath3);
    const list = [];
    for (let i = 0; i < 10; i++) {
      list.push(random());
    }
    list.sort((a, b) =>
      Buffer.compare(Buffer.bufferFrom(a[0]), Buffer.bufferFrom(b[0])),
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
  });
});
