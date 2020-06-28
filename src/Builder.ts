/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Status from "./Status";
import { Env, FileHandle } from "./Env";
import { FileMetaData } from "./VersionFormat";
import { getTableFilename } from "./Filename";
import SSTableBuilder from "./SSTableBuilder";
import { Options } from "./Options";
import { InternalKey, Entry } from "./Format";
import { assert } from "console";

export async function buildTable(
  dbpath: string,
  env: Env,
  options: Options,
  iterator: IterableIterator<Entry>,
  meta: FileMetaData,
): Promise<Status> {
  options.log(`Level-0 table #${meta.number}: started`);

  const tableFilename = getTableFilename(dbpath, meta.number);
  let status = new Status(env.open(tableFilename, "a+"));
  if (!(await status.ok())) {
    return status;
  }
  const builder = new SSTableBuilder(
    options,
    (await status.promise) as FileHandle,
  );
  for (const entry of iterator) {
    if (!meta.smallest) {
      meta.smallest = InternalKey.from(entry.key);
    }
    meta.largest.decodeFrom(entry.key);
    await builder.add(entry.key, entry.value);
  }

  status = new Status(builder.finish());
  if (!(await status.ok())) {
    return status;
  }
  meta.fileSize = builder.fileSize;
  assert(meta.fileSize > 0);
  options.log(
    `Level-0 table #${meta.number}: ${meta.fileSize} bytes ${
      (await status.ok()) ? "status ok" : "status error"
    }`,
  );
  // TODO check if table has errors
  return status;
}
