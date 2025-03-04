"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlkanesCompiler = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class AlkanesCompiler {
    constructor(options = {}) {
        this.options = {
            tempDir: ".alkanes",
            target: "wasm32-unknown-unknown",
            optimize: 3,
            output: "build",
            dependencies: {},
            ...options,
        };
    }
    async compileFile(filePath, options = {}) {
        try {
            console.log(`Reading contract file: ${filePath}`);
            const sourceCode = await promises_1.default.readFile(filePath, "utf8");
            const fileName = path_1.default.basename(filePath, ".rs");
            const outputDir = options.output || this.options.output;
            if (!outputDir) {
                throw new Error("Output directory is not defined");
            }
            console.log(`Compiling ${fileName}...`);
            const result = await this.compile(sourceCode, options);
            if (!result) {
                throw new Error("Compilation returned no result");
            }
            await promises_1.default.mkdir(outputDir, { recursive: true });
            const wasmPath = path_1.default.join(outputDir, `${fileName}.wasm`);
            await promises_1.default.writeFile(wasmPath, Buffer.from(result.bytecode, "base64"));
            console.log(`WASM written to: ${wasmPath}`);
            const abiPath = path_1.default.join(outputDir, `${fileName}.json`);
            await promises_1.default.writeFile(abiPath, JSON.stringify(result.abi, null, 2));
            console.log(`ABI written to: ${abiPath}`);
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to compile ${filePath}: ${error.message}`);
            }
            throw error;
        }
    }
    async compile(sourceCode, options = {}) {
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
            const { stdout, stderr } = await execAsync(`cargo build --target ${target} --release --config "profile.release.opt-level=${optimize}"`, { cwd: tempDir });
            if (stderr) {
                console.warn("Build warnings:", stderr);
            }
            // Read the WASM file directly from target directory
            const wasmPath = path_1.default.join(tempDir, `target/${target}/release/alkanes_contract.wasm`);
            const wasmBuffer = await promises_1.default.readFile(wasmPath);
            // Parse ABI from source code
            const abi = await this.parseABI(sourceCode);
            return {
                bytecode: wasmBuffer.toString("base64"),
                abi,
            };
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Compilation failed: ${error.message}`);
            }
            throw new Error("Compilation failed with unknown error");
        }
    }
    async createProject(sourceCode) {
        const tempDir = this.options.tempDir;
        if (!tempDir) {
            throw new Error("Temp directory is not defined");
        }
        await promises_1.default.mkdir(tempDir, { recursive: true });
        await promises_1.default.mkdir(path_1.default.join(tempDir, "src"), { recursive: true });
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
                }
                else {
                    let depSpec = "{ ";
                    if (spec.git)
                        depSpec += `git = "${spec.git}"`;
                    if (spec.version)
                        depSpec += `${spec.git ? ", " : ""}version = "${spec.version}"`;
                    if (spec.features && spec.features.length) {
                        depSpec += `${spec.git || spec.version ? ", " : ""}features = [${spec.features.map((f) => `"${f}"`).join(", ")}]`;
                    }
                    depSpec += " }";
                    cargoToml += `${name} = ${depSpec}\n`;
                }
            }
        }
        await promises_1.default.writeFile(path_1.default.join(tempDir, "Cargo.toml"), cargoToml);
        await promises_1.default.writeFile(path_1.default.join(tempDir, "src", "lib.rs"), sourceCode);
    }
    async parseABI(sourceCode) {
        const tempFile = path_1.default.join(".alkanes", "temp_contract.rs");
        await promises_1.default.mkdir(".alkanes", { recursive: true });
        await promises_1.default.writeFile(tempFile, sourceCode);
        try {
            // Ensure the binary path is correct
            const rustBinary = path_1.default.join(__dirname, "../bin/abi_extractor/target/release/abi_extractor");
            // Call the Rust-based ABI extractor
            const { stdout } = await execAsync(`${rustBinary} ${tempFile}`);
            return JSON.parse(stdout);
        }
        catch (error) {
            throw new Error(`Failed to extract ABI: ${error instanceof Error ? error.message : error}`);
        }
    }
}
exports.AlkanesCompiler = AlkanesCompiler;
//# sourceMappingURL=compiler.js.map