import { Database } from "../build/port/node";
import { Buffer } from "../build/src/Buffer";
import { random } from "../fixtures/random";
import { createDir, cleanup } from "../fixtures/dbpath";
import fs from "fs";
import path from "path";
import { argv } from "yargs";
import { allocRunner } from "../fixtures/runner";

function now(): number {
  return Number(process.hrtime.bigint()) / Math.pow(10, 6);
}

async function bench(total: number, runnerCount: number): Promise<void> {
  try {
    const dataset = [];
    for (let i = 0; i < total; i++) {
      const strEntry = random(16, 100);
      dataset.push([
        Buffer.fromUnknown(strEntry[0]),
        Buffer.fromUnknown(strEntry[1]),
      ]);
    }

    const dbpath = createDir("bench");
    cleanup(dbpath);

    const db = new Database(dbpath, { lockfileStale: 10 });
    await db.ok();

    console.log("db: ok");

    const startTime = now();

    await allocRunner(runnerCount, db, dataset);

    const endTime = now();
    const totalTime = endTime - startTime;

    const file = await fs.promises.open(
      path.resolve(__dirname, "../bench.log"),
      "a+",
    );
    const log = `
  time    : ${new Date().toISOString()}
  key     : 16 bytes
  value   : 100 bytes
  total   : ${total}
  runners : ${runnerCount} 
  speed   : ${totalTime.toFixed(2)} ms total; ${(
      (totalTime / total) *
      1000
    ).toFixed(2)} us/op
  `;
    console.log(log);
    await file.appendFile(log);
    await db.close();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

console.log(argv);
bench(parseInt(argv.total as string), parseInt(argv.runners as string));
