import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { AlkanesABI } from "./types";

const execAsync = promisify(exec);

export interface AlkanesCompilerOptions {
  tempDir?: string;
  target?: string;
  optimize?: string | number;
  output?: string;
  dependencies?: Record<
    string,
    string | { git?: string; version?: string; features?: string[] }
  >;
}

export class AlkanesCompiler {
  private options: AlkanesCompilerOptions;

  constructor(options: AlkanesCompilerOptions = {}) {
    this.options = {
      tempDir: ".alkanes",
      target: "wasm32-unknown-unknown",
      optimize: 3,
      output: "build",
      dependencies: {},
      ...options,
    };
  }

  async compileFile(
    filePath: string,
    options: {
      optimize?: string | number;
      output?: string;
    } = {}
  ): Promise<{ bytecode: string; abi: AlkanesABI }> {
    try {
      console.log(`Reading contract file: ${filePath}`);
      const sourceCode = await fs.readFile(filePath, "utf8");

      const fileName = path.basename(filePath, ".rs");
      const outputDir = options.output || this.options.output;

      if (!outputDir) {
        throw new Error("Output directory is not defined");
      }

      console.log(`Compiling ${fileName}...`);
      const result = await this.compile(sourceCode, options);

      if (!result) {
        throw new Error("Compilation returned no result");
      }

      await fs.mkdir(outputDir, { recursive: true });

      const wasmPath = path.join(outputDir, `${fileName}.wasm`);
      await fs.writeFile(wasmPath, Buffer.from(result.bytecode, "base64"));
      console.log(`WASM written to: ${wasmPath}`);

      const abiPath = path.join(outputDir, `${fileName}.json`);
      await fs.writeFile(abiPath, JSON.stringify(result.abi, null, 2));
      console.log(`ABI written to: ${abiPath}`);

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to compile ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  async compile(
    sourceCode: string,
    options: {
      optimize?: string | number;
    } = {}
  ): Promise<{ bytecode: string; abi: AlkanesABI }> {
    try {
      // Create temporary project
      await this.createProject(sourceCode);

      // Use options from method call or fall back to constructor options
      const optimize = options.optimize || this.options.optimize;
      const target = this.options.target;
      const tempDir = this.options.tempDir;

      if (!tempDir) {
        throw new Error("Temp directory is not defined");
      }

      // Run direct cargo build with optimization level
      const { stdout, stderr } = await execAsync(
        `cargo build --target ${target} --release --config "profile.release.opt-level=${optimize}"`,
        { cwd: tempDir }
      );

      if (stderr) {
        console.warn("Build warnings:", stderr);
      }

      // Read the WASM file directly from target directory
      const wasmPath = path.join(
        tempDir,
        `target/${target}/release/alkanes_contract.wasm`
      );
      const wasmBuffer = await fs.readFile(wasmPath);

      // Parse ABI from source code
      const abi = await this.parseABI(sourceCode);

      return {
        bytecode: wasmBuffer.toString("base64"),
        abi,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Compilation failed: ${error.message}`);
      }
      throw new Error("Compilation failed with unknown error");
    }
  }

  private async createProject(sourceCode: string) {
    const tempDir = this.options.tempDir;
    if (!tempDir) {
      throw new Error("Temp directory is not defined");
    }

    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });

    // Start with base Cargo.toml
    let cargoToml = `
[package]
name = "alkanes-contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
alkanes-runtime = { path = "../../alkanes-rs/crates/alkanes-runtime" }
alkanes-support = { path = "../../alkanes-rs/crates/alkanes-support" }
metashrew-support = { path = "../../alkanes-rs/crates/metashrew-support" }
alkanes-macros = { path = "../../alkanes-rs/crates/alkanes-macros" }
alkanes-types = { path = "../../alkanes-rs/crates/alkanes-types" }
anyhow = "1.0"
hex_lit = "0.1.1"
`;

    // Add any additional dependencies from config
    if (this.options.dependencies) {
      for (const [name, spec] of Object.entries(this.options.dependencies)) {
        if (typeof spec === "string") {
          cargoToml += `${name} = "${spec}"\n`;
        } else {
          let depSpec = "{ ";
          if (spec.git) depSpec += `git = "${spec.git}"`;
          if (spec.version)
            depSpec += `${spec.git ? ", " : ""}version = "${spec.version}"`;
          if (spec.features && spec.features.length) {
            depSpec += `${
              spec.git || spec.version ? ", " : ""
            }features = [${spec.features.map((f) => `"${f}"`).join(", ")}]`;
          }
          depSpec += " }";
          cargoToml += `${name} = ${depSpec}\n`;
        }
      }
    }

    await fs.writeFile(path.join(tempDir, "Cargo.toml"), cargoToml);
    await fs.writeFile(path.join(tempDir, "src", "lib.rs"), sourceCode);
  }

  async parseABI(sourceCode: string): Promise<AlkanesABI> {
    const tempFile = path.join(".alkanes", "temp_contract.rs");
    await fs.mkdir(".alkanes", { recursive: true });
    await fs.writeFile(tempFile, sourceCode);

    try {
      // Ensure the binary path is correct
      const rustBinary = path.join(
        __dirname,
        "../bin/abi_extractor/target/release/abi_extractor"
      );

      // Call the Rust-based ABI extractor
      const { stdout } = await execAsync(`${rustBinary} ${tempFile}`);

      return JSON.parse(stdout) as AlkanesABI;
    } catch (error) {
      throw new Error(
        `Failed to extract ABI: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }
}
