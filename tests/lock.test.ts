import { Database } from "../port/node";
import { createDir, cleanup } from "../fixtures/dbpath";
import { copydb } from "../fixtures/copydb";
// @ts-ignore make jest happy
global.TextEncoder = require("util").TextEncoder;

jest.setTimeout(60000 * 10);

const dbpath = createDir();
const dbpath3 = createDir();
afterAll(() => {
  cleanup(dbpath);
  cleanup(dbpath3);
});

cleanup(dbpath);

test("lock", async (done) => {
  const db1 = new Database(dbpath, { debug: true });
  expect(await db1.ok()).toBe(true);
  const db2 = new Database(dbpath);
  await expect(db2.ok()).rejects.toThrowError(/Lock fail/);
  await copydb(dbpath, dbpath3);
  const db3 = new Database(dbpath3);
  await expect(db3.ok()).resolves.toBe(true);
  done();
});
