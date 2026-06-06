import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pluginRoot = process.env.BEACON_ROOT || dirname(dirname(fileURLToPath(import.meta.url)));
const nodeModules = join(pluginRoot, "node_modules");

if (!existsSync(nodeModules)) {
  process.stderr.write("Beacon: installing dependencies (first run)...\n");
  try {
    execFileSync("bun", ["install", "--production"], {
      cwd: pluginRoot,
      timeout: 120_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    process.stderr.write("Beacon: dependencies installed successfully.\n");
  } catch (err) {
    process.stderr.write(
      `Beacon: failed to install dependencies. Run 'bun install' manually in ${pluginRoot}\n`
    );
    if (err.stderr) process.stderr.write(err.stderr.toString());
    process.exit(1);
  }
}
