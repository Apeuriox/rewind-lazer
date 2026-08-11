const { existsSync } = require("fs");
const { dirname, join } = require("path");
const { spawnSync } = require("child_process");

const realmPackagePath = require.resolve("realm/package.json");
const realmDirectory = dirname(realmPackagePath);
const realmPackage = require(realmPackagePath);
const binaryPath = join(realmDirectory, realmPackage.binary.module_path, `${realmPackage.binary.module_name}.node`);

if (!existsSync(binaryPath)) {
  const napiVersion = Math.min(...realmPackage.binary.napi_versions);
  const installer = require.resolve("prebuild-install/bin.js", { paths: [realmDirectory] });
  const result = spawnSync(process.execPath, [installer, "--runtime", "napi", "--target", String(napiVersion)], {
    cwd: realmDirectory,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
