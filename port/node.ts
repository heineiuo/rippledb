import { InternalDatabase, Env, Options } from "../src";
import fs from "fs";
import os from "os";
import { FileHandle } from "../src/Env";

class NodeEnv implements Env {
  platform(): string {
    return os.platform();
  }
  /**
   * get current time
   */
  now(): number {
    return Number(process.hrtime.bigint()) / Math.pow(10, 9);
  }

  access(dbpath: string): Promise<void> {
    return fs.promises.access(dbpath, fs.constants.W_OK);
  }

  mkdir(dbpath: string): Promise<void> {
    return fs.promises.mkdir(dbpath, { recursive: true });
  }

  writeFile = fs.promises.writeFile;
  readFile = fs.promises.readFile;
  open = fs.promises.open;
  rename = fs.promises.rename;
  unlink = fs.promises.unlink;
  unlinkSync = fs.unlinkSync;
  fstat = fs.promises.fstat;

  // eslint-disable-next-line
  readdir(dbpath: string) {
    return fs.promises.readdir(dbpath, { withFileTypes: true });
  }

  async infoLog(handle: FileHandle, message: string): Promise<void> {
    const finalMessage = `${new Date().toISOString()} ${message}\n`;
    await handle.appendFile(finalMessage);
  }
}

export default class Database extends InternalDatabase {
  constructor(dbpath: string, options: Options) {
    if (!options.env) options.env = new NodeEnv();
    super(dbpath, options);
  }
}
