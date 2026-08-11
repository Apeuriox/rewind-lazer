import { join } from "path";
import { lazerStoragePath, mimeTypeFor } from "./LazerFileStore";

describe("lazer file storage", () => {
  const hash = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  it("maps a SHA-256 hash to osu!lazer's content-addressed path", () => {
    expect(lazerStoragePath("lazer", hash)).toBe(join("lazer", "files", "a", "ab", hash));
  });

  it("rejects invalid hashes returned by the database reader", () => {
    expect(() => lazerStoragePath("lazer", "../client.realm")).toThrow("Invalid SHA-256");
  });

  it("preserves the MIME type of extensionless stored assets", () => {
    expect(mimeTypeFor("song.MP3")).toBe("audio/mpeg");
    expect(mimeTypeFor("background.jpg")).toBe("image/jpeg");
    expect(mimeTypeFor("unknown.bin")).toBe("application/octet-stream");
  });
});
