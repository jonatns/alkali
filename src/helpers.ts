import fs from "fs/promises";
import path from "path";

export function handleCommandError(error: any) {
  if (error instanceof Error) {
    console.error("❌ Command failed:", error.message);
  } else {
    console.error("❌ Command failed:", error);
  }
  process.exit(1);
}

export async function loadConfig(configPath: string): Promise<any> {
  try {
    const configContent = await fs.readFile(configPath, "utf8");
    return JSON.parse(configContent);
  } catch (error) {
    return {
      dependencies: {},
      compiler: {
        optimizeLevel: 3,
        target: "wasm32-unknown-unknown",
      },
      contracts: {
        outputDir: "build",
      },
    };
  }
}

export async function findContractFiles(sources: string[]): Promise<string[]> {
  const files: string[] = [];

  for (const source of sources) {
    const stat = await fs.stat(source);

    if (stat.isDirectory()) {
      // Read all .rs files in directory
      const entries = await fs.readdir(source, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".rs")) {
          files.push(path.join(source, entry.name));
        }
      }
    } else if (source.endsWith(".rs")) {
      files.push(source);
    }
  }

  return files;
}
