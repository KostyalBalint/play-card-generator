/**
 * Client-side upload of a reference picture to a set. Shared by the picker in
 * components/FaceForm and the asset grid in components/ReferenceManager — both
 * post to /api/sets/[setId]/references, which normalises the file to PNG.
 */
export async function uploadReferenceImage(
  setId: string,
  file: File,
): Promise<{ id: string; name: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/sets/${setId}/references`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data;
}
