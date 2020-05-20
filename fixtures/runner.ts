import { Buffer } from "../third_party/buffer";

interface Database {
  put: (key: string | Buffer, value: string | Buffer) => Promise<void>;
}

type Entry = [string | Buffer, string | Buffer];

export async function runner(
  db: Database,
  dataset: Entry[],
  skip: number,
  start: number,
): Promise<void> {
  let current = start;
  const total = dataset.length;
  while (true) {
    if (current >= total) return;
    const entry = dataset[current];
    await db.put(entry[0], entry[1]);
    current += skip;
  }
}

export async function allocRunner(
  runnerCount: number,
  db: Database,
  dataset: Entry[],
): Promise<void> {
  await Promise.all(
    Array.from({ length: runnerCount }, (v, start) => {
      return runner(db, dataset, runnerCount, start);
    }),
  );
}
