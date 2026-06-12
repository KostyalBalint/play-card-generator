import path from "node:path";
import fs from "node:fs/promises";

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
