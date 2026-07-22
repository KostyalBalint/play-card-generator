import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

const STORAGE_DIR = path.resolve(process.cwd(), process.env.STORAGE_DIR ?? "storage");

export function storagePath(relPath: string) {
  return path.join(STORAGE_DIR, relPath);
}

export async function writeStorageFile(relPath: string, data: Buffer) {
  const abs = storagePath(relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
}

export async function readStorageFile(relPath: string) {
  return fs.readFile(storagePath(relPath));
}

/** Remove a file, ignoring one that is already gone. */
export async function deleteStorageFile(relPath: string) {
  await fs.rm(storagePath(relPath), { force: true });
}

/**
 * A file as a web stream plus its size, for handing straight to a Response.
 * Exports are tens of MB; streaming keeps them off the server's heap.
 */
export async function readStorageStream(relPath: string) {
  const abs = storagePath(relPath);
  const { size } = await fs.stat(abs);
  return { size, stream: Readable.toWeb(createReadStream(abs)) as ReadableStream<Uint8Array> };
}
