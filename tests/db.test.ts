import { Database } from "../port/node";
import { random } from "../fixtures/random";
import { createDir, cleanup } from "../fixtures/dbpath";
import { copydb } from "../fixtures/copydb";

jest.setTimeout(60000 * 10);
// @ts-ignore make jest happy
global.TextEncoder = require("util").TextEncoder;

const dbpath = createDir();
const dbpath1 = createDir();
const dbpath2 = createDir();
const dbpath3 = createDir();
const dbpath4 = createDir();
afterAll(() => {
  cleanup(dbpath);
  cleanup(dbpath1);
  cleanup(dbpath2);
  cleanup(dbpath3);
  cleanup(dbpath4);
});

describe("Database", () => {
  test("read record from db", async (done) => {
    const db = new Database(dbpath1);
    await db.put("key", "world");
    const result = await db.get("key");
    expect(!!result).toBe(true);
    expect(String.fromCharCode.apply(null, result)).toBe("world");
    await db.destroy();
    done();
  });

  test("recovery", async (done) => {
    const debugOptions = { debug: true };
    const db = new Database(dbpath, debugOptions);
    await db.ok();
    await db.put("key", "world");
    await db.destroy();

    await new Promise((resolve) => setTimeout(resolve, 500));
    await copydb(dbpath, dbpath2);

    const db2 = new Database(dbpath2, debugOptions);
    await db2.ok();
    await db2.put("key", "world");
    await db2.destroy();

    await new Promise((resolve) => setTimeout(resolve, 500));
    await copydb(dbpath2, dbpath3);

    const db3 = new Database(dbpath3, debugOptions);
    await db3.ok();
    for (let i = 0; i < 1000; i++) {
      const [key, value] = random();
      await db3.put(key, value);
    }
    await db3.put("key", "world");
    await db3.destroy();

    await new Promise((resolve) => setTimeout(resolve, 1500));
    await copydb(dbpath3, dbpath4);

    const db4 = new Database(dbpath4, debugOptions);
    await db4.ok();
    await db4.put("key", "world");
    await db4.destroy();

    const result = await db4.get("key");
    expect(!!result).toBe(true);
    expect(String.fromCharCode.apply(null, result)).toBe("world");

    done();
  });
});
