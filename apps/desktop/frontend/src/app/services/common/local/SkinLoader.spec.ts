import { join } from "path";
import { fileURLToPath } from "url";
import { skinTextureFileUrl } from "./SkinLoader";

describe("skinTextureFileUrl", () => {
  it("encodes reserved characters and unicode in a skin path", () => {
    const folder = join(process.cwd(), "Skins", "-     #『シロバナ』Shirobana;Aloic");
    const relativePath = "Fonts/score/score-0@2x.png";
    const result = skinTextureFileUrl(folder, relativePath);

    expect(new URL(result).hash).toBe("");
    expect(result).toContain("%23");
    expect(fileURLToPath(result)).toBe(join(folder, relativePath));
  });
});
