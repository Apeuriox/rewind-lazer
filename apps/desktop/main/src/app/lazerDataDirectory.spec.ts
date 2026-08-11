import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { resolveLazerDataDirectory } from "./lazerDataDirectory";

describe("resolveLazerDataDirectory", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "rewind-lazer-data-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function createDataDirectory(directoryPath: string) {
    await mkdir(join(directoryPath, "files"), { recursive: true });
    await writeFile(join(directoryPath, "client.realm"), "realm");
  }

  it("accepts a directly configured lazer data directory", async () => {
    const dataDirectory = join(root, "data");
    await createDataDirectory(dataDirectory);

    await expect(resolveLazerDataDirectory(dataDirectory, "")).resolves.toBe(resolve(dataDirectory));
  });

  it("follows the FullPath redirect in the default storage.ini", async () => {
    const entryDirectory = join(root, "osu");
    const dataDirectory = join(root, "custom", "osu-lazer");
    await mkdir(entryDirectory, { recursive: true });
    await createDataDirectory(dataDirectory);
    await writeFile(join(entryDirectory, "storage.ini"), `FullPath = ${dataDirectory}\n`);

    await expect(resolveLazerDataDirectory("", root)).resolves.toBe(resolve(dataDirectory));
  });

  it("does not accept a directory without both the Realm and file store", async () => {
    await mkdir(join(root, "osu"), { recursive: true });
    await expect(resolveLazerDataDirectory("", root)).resolves.toBeNull();
  });
});
