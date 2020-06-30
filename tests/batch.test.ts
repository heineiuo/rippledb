import { Database } from "../port/node";
import { random } from "../fixtures/random";
import { createDir, cleanup } from "../fixtures/dbpath";
import { WriteBatch } from "../src/WriteBatch";
// @ts-ignore make jest happy
global.TextEncoder = require("util").TextEncoder;

const dbpath = createDir();
afterAll(() => {
  cleanup(dbpath);
});

describe("WriteBatch", () => {
  test("batch", async (done) => {
    const debugOptions = { debug: true };

    const db = new Database(dbpath, debugOptions);
    const batch = new WriteBatch();
    let delKey = null;
    let getKey = null;
    for (let i = 0; i < 100; i++) {
      const entry = random();
      if (i === 50) delKey = entry[0];
      if (i === 51) getKey = entry[0];
      batch.put(entry[0], entry[1]);
    }
    batch.del(delKey);

    await db.batch(batch);

    expect(!!(await db.get(getKey))).toBe(true);
    expect(!!(await db.get(delKey))).toBe(false);

    await db.close();

    done();
  });
});
