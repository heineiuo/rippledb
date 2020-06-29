import { Database, DBRepairer } from "../port/node";
import { random } from "../fixtures/random";
import { createDir, cleanup } from "../fixtures/dbpath";
import fs from "fs";
import path from "path";
import { allocRunner } from "../fixtures/runner";
import { Buffer } from "../src/Buffer";

jest.setTimeout(60000 * 10);
// @ts-ignore make jest happy
global.TextEncoder = require("util").TextEncoder;

const dbpath1 = createDir();
cleanup(dbpath1);

describe("DBRepairer", () => {
  test("Create a damaged db and repair it.", async (done) => {
    const db = new Database(dbpath1);
    const dataset: [string | Buffer, string | Buffer][] = [];
    for (let i = 0; i < 10000; i++) {
      dataset.push(random());
    }
    await allocRunner(10, db, dataset);
    await db.compactRange(
      Buffer.alloc(16).fill(0x00),
      Buffer.alloc(16).fill(0xff),
    );
    await db.destroy();
    await fs.promises.unlink(path.resolve(dbpath1, "MANIFEST-000002"));
    await fs.promises.unlink(path.resolve(dbpath1, "CURRENT"));

    const repairer = new DBRepairer(dbpath1, { debug: true });
    await expect(repairer.run()).resolves.toBe(undefined);

    done();
  });
});
