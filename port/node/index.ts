import { InternalDatabase, Env, DatabaseOptions } from "../../src";
import fs from "fs";
import os from "os";
import { FileHandle } from "../../src/Env";
import { onExit } from "./cleanup";

export class NodeEnv implements Env {
  platform(): string {
    return os.platform();
  }
  /**
   * get current time
   */
  now(): number {
    return Number(process.hrtime.bigint()) / Math.pow(10, 9);
  }

  onExit = onExit;

  access(dbpath: string): Promise<void> {
    return fs.promises.access(dbpath, fs.constants.W_OK);
  }

  mkdir(dbpath: string): Promise<void> {
    return fs.promises.mkdir(dbpath, { recursive: true });
  }

  async getFileTime(filename: string): Promise<number> {
    const filetimeName = this.platform() === "win32" ? "mtime" : "ctime";
    const stats = await fs.promises.stat(filename);
    const time = new Date(stats[filetimeName]).getTime();
    return time;
  }

  writeFile = fs.promises.writeFile;
  readFile = async (path: string): Promise<string> => {
    return await fs.promises.readFile(path, "utf8");
  };
  open = fs.promises.open;
  rename = fs.promises.rename;
  unlink = fs.promises.unlink;
  unlinkSync = fs.unlinkSync;

  // eslint-disable-next-line
  readdir(dbpath: string) {
    return fs.promises.readdir(dbpath, { withFileTypes: true });
  }

  async infoLog(handle: FileHandle, message: string): Promise<void> {
    const finalMessage = `${new Date().toISOString()} ${message}\n`;
    await handle.appendFile(finalMessage);
  }
}

export class Database extends InternalDatabase {
  constructor(dbpath: string, options: DatabaseOptions = {}) {
    if (!options.env) options.env = new NodeEnv();
    super(dbpath, options);
  }
}
