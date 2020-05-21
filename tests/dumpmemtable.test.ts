import { Database } from "../port/node";
import { createDir, cleanup } from "../fixtures/dbpath";

const dbpath1 = createDir();
afterAll(() => {
  cleanup(dbpath1);
});

// @ts-ignore make jest happy
global.TextEncoder = require("util").TextEncoder;

cleanup(dbpath1);

describe("Dump memtable", () => {
  test("db manual compaction", async (done) => {
    const db = new Database(dbpath1);
    await db.put("key", "world");
    await db.put("key1", "world1");
    await db.put("key", "world2");
    await db.del("key1");
    await db.compactRange("k", "kc");
    const result = await db.get("key");
    expect(!!result).toBe(true);
    expect(String.fromCharCode.apply(null, result)).toBe("world2");
    const result2 = await db.get("key1");
    expect(!!result2).toBe(false);
    done();
  });
});
