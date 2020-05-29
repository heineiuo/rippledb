/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

type BufferEncoding =
  | "ascii"
  | "utf8"
  | "utf-8"
  | "utf16le"
  | "ucs2"
  | "ucs-2"
  | "base64"
  | "latin1"
  | "binary"
  | "hex";

export interface Dirent {
  isFile(): boolean;
  isDirectory(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isSymbolicLink(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
  name: string;
}

export interface FileHandle {
  /**
   * Asynchronously append data to a file, creating the file if it does not exist. The underlying file will _not_ be closed automatically.
   * The `FileHandle` must have been opened for appending.
   * @param data The data to write. If something other than a `Buffer` or `Uint8Array` is provided, the value is coerced to a string.
   * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
   * If `encoding` is not supplied, the default of `'utf8'` is used.
   * If `mode` is not supplied, the default of `0o666` is used.
   * If `mode` is a string, it is parsed as an octal integer.
   * If `flag` is not supplied, the default of `'a'` is used.
   */
  appendFile(
    data: any,
    options?:
      | {
          encoding?: string | null;
          mode?: string | number;
          flag?: string | number;
        }
      | string
      | null,
  ): Promise<void>;

  /**
   * Asynchronously reads data from the file.
   * The `FileHandle` must have been opened for reading.
   * @param buffer The buffer that the data will be written to.
   * @param offset The offset in the buffer at which to start writing.
   * @param length The number of bytes to read.
   * @param position The offset from the beginning of the file from which data should be read. If `null`, data will be read from the current position.
   */
  read<TBuffer extends Uint8Array>(
    buffer: TBuffer,
    offset?: number | null,
    length?: number | null,
    position?: number | null,
  ): Promise<{ bytesRead: number; buffer: TBuffer }>;

  /**
   * Asynchronously reads the entire contents of a file. The underlying file will _not_ be closed automatically.
   * The `FileHandle` must have been opened for reading.
   * @param options An object that may contain an optional flag.
   * If a flag is not provided, it defaults to `'r'`.
   */
  readFile(
    options?: { encoding?: null; flag?: string | number } | null,
  ): Promise<Uint8Array>;

  /**
   * Asynchronously reads the entire contents of a file. The underlying file will _not_ be closed automatically.
   * The `FileHandle` must have been opened for reading.
   * @param options An object that may contain an optional flag.
   * If a flag is not provided, it defaults to `'r'`.
   */
  readFile(
    options:
      | { encoding: BufferEncoding; flag?: string | number }
      | BufferEncoding,
  ): Promise<string>;

  /**
   * Asynchronously reads the entire contents of a file. The underlying file will _not_ be closed automatically.
   * The `FileHandle` must have been opened for reading.
   * @param options An object that may contain an optional flag.
   * If a flag is not provided, it defaults to `'r'`.
   */
  readFile(
    options?:
      | { encoding?: string | null; flag?: string | number }
      | string
      | null,
  ): Promise<string | Uint8Array>;

  /**
   * Asynchronously writes `buffer` to the file.
   * The `FileHandle` must have been opened for writing.
   * @param buffer The buffer that the data will be written to.
   * @param offset The part of the buffer to be written. If not supplied, defaults to `0`.
   * @param length The number of bytes to write. If not supplied, defaults to `buffer.length - offset`.
   * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
   */
  write<TBuffer extends Uint8Array>(
    buffer: TBuffer,
    offset?: number | null,
    length?: number | null,
    position?: number | null,
  ): Promise<{ bytesWritten: number; buffer: TBuffer }>;

  /**
   * Asynchronously writes `string` to the file.
   * The `FileHandle` must have been opened for writing.
   * It is unsafe to call `write()` multiple times on the same file without waiting for the `Promise`
   * to be resolved (or rejected). For this scenario, `fs.createWriteStream` is strongly recommended.
   * @param string A string to write. If something other than a string is supplied it will be coerced to a string.
   * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
   * @param encoding The expected string encoding.
   */
  write(
    data: any,
    position?: number | null,
    encoding?: string | null,
  ): Promise<{ bytesWritten: number; buffer: string }>;

  /**
   * Asynchronously writes data to a file, replacing the file if it already exists. The underlying file will _not_ be closed automatically.
   * The `FileHandle` must have been opened for writing.
   * It is unsafe to call `writeFile()` multiple times on the same file without waiting for the `Promise` to be resolved (or rejected).
   * @param data The data to write. If something other than a `Buffer` or `Uint8Array` is provided, the value is coerced to a string.
   * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
   * If `encoding` is not supplied, the default of `'utf8'` is used.
   * If `mode` is not supplied, the default of `0o666` is used.
   * If `mode` is a string, it is parsed as an octal integer.
   * If `flag` is not supplied, the default of `'w'` is used.
   */
  writeFile(
    data: any,
    options?:
      | {
          encoding?: string | null;
          mode?: string | number;
          flag?: string | number;
        }
      | string
      | null,
  ): Promise<void>;

  /**
   * Asynchronous close(2) - close a `FileHandle`.
   */
  close(): Promise<void>;
}

export interface Env {
  onExit(callback: () => void): void;

  platform(): string;
  // get current time
  now(): number;
  access(dbpath: string): Promise<void>;
  mkdir(dbpath: string): Promise<void>;
  rename(oldpath: string, newpath: string): Promise<void>;
  writeFile(dbpath: string, content: Uint8Array | string): Promise<void>;
  open(dbpath: string, flag?: string): Promise<FileHandle>;
  unlink(filename: string): Promise<void>;
  unlinkSync(filename: string): void;
  readdir(dbpath: string): Promise<Dirent[]>;
}
