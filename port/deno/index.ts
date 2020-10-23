import {
  InternalDatabase,
  DatabaseOptions,
} from "https://cdn.jsdelivr.net/gh/heineiuo/rippledb-deno@2a79f5c/index.ts";
import {
  Env,
  FileHandle,
  BufferEncoding,
  Dirent,
} from "https://cdn.jsdelivr.net/gh/heineiuo/rippledb-deno@2a79f5c/Env.ts";

export { InternalDatabase, Env, DatabaseOptions };

declare const Deno: any;

class DenoFile implements FileHandle {
  constructor(file: Deno.File) {
    this.file = file;
  }
  file: Deno.File;

  async appendFile(data: Uint8Array): Promise<void> {
    await this.file.write(data);
  }
  async readFile(): Promise<string> {
    return new TextDecoder().decode(await this.file.read());
  }
}

export class DenoEnv implements Env {
  onExit(): void {
    return;
  }

  platform(): string {
    return Deno.build.os === "windows" ? "win32" : Deno.build.os;
  }

  now(): number {
    return performance.now() / 1000;
  }

  async access(filename: string): Promise<void> {
    await Deno.open(filename);
    await Deno.close(filename);
  }

  async mkdir(path: string): Promise<void> {
    await Deno.mkdir(path, { recursive: true });
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    if (typeof data === "string") {
      await Deno.writeFile(path, new TextEncoder().encode(data));
    } else {
      await Deno.writeFile(path, data);
    }
  }

  async open(path: string, mode: string): Promise<DenoFile> {
    const options: Deno.OpenOptions = {};
    if (mode.includes("r")) {
      options.read = true;
    }
    if (mode.includes("a")) {
      options.append = true;
    }
    const file = await Deno.open(path, options);
    return new DenoFile(file);
  }

  rename = Deno.rename;

  unlink = Deno.remove;
  unlinkSync = Deno.removeSync;

  async readdir(path: string): Promise<Dirent[]> {
    const result = [];
    for await (const dirEntry of Deno.readDir(path)) {
      result.push(dirEntry.name);
    }
    return result;
  }
}

export class Database extends InternalDatabase {
  constructor(dbpath: string, options: DatabaseOptions = {}) {
    if (!options.env) options.env = new DenoEnv();
    super(dbpath, options);
  }
}
