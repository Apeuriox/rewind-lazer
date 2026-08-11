import { join } from "path";

const sha256Pattern = /^[a-f0-9]{64}$/i;

export function lazerStoragePath(root: string, hash: string) {
  if (!sha256Pattern.test(hash)) {
    throw new Error(`Invalid SHA-256 returned by the lazer database reader: ${hash}`);
  }
  return join(root, "files", hash.slice(0, 1), hash.slice(0, 2), hash);
}

export function mimeTypeFor(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "mp3":
      return "audio/mpeg";
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    default:
      return "application/octet-stream";
  }
}
