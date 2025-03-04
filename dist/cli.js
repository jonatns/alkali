#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const index_1 = require("./index");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const helpers_1 = require("./helpers");
const program = new commander_1.Command();
program
    .name("alkali")
    .description("Smart contract development toolkit for Bitcoin Alkanes")
    .version("0.1.0");
program
    .command("init")
    .description("Initialize a new Alkali project")
    .option("-t, --template <name>", "Template to use", "default")
    .action(async (options) => {
    try {
        console.log("🔥 Initializing Alkali project...");
        // Create project structure
        await promises_1.default.mkdir("contracts", { recursive: true });
        await promises_1.default.mkdir("build", { recursive: true });
        await promises_1.default.mkdir("scripts", { recursive: true });
        // Get template path
        const templatePath = path_1.default.join(__dirname, "..", "templates", options.template);
        // Check if template exists
        try {
            await promises_1.default.access(templatePath);
        }
        catch (err) {
            console.error(`Template "${options.template}" not found`);
            process.exit(1);
        }
        // Copy contract template
        const contractTemplatePath = path_1.default.join(templatePath, "contracts", "Example.rs");
        const contractDest = path_1.default.join("contracts", "Example.rs");
        await promises_1.default.copyFile(contractTemplatePath, contractDest);
        // Create config file
        const configContent = {
            name: path_1.default.basename(process.cwd()),
            compiler: {
                target: "wasm32-unknown-unknown",
                optimizeLevel: 3,
            },
        };
        await promises_1.default.writeFile("alkali.config.json", JSON.stringify(configContent, null, 2));
        console.log("✅ Project initialized successfully");
        console.log("\nNext steps:");
        console.log("  1. npx alkali compile            # Compile contracts");
        console.log("  2. npx alkali test               # Run tests");
        console.log("  3. npx alkali deploy             # Deploy contracts");
    }
    catch (error) {
        console.error("❌ Failed to initialize project", error);
        process.exit(1);
    }
});
program
    .command("compile")
    .description("Compile Alkanes contracts to WASM")
    .argument("[file]", "Contract source file") // Use square brackets to make it optional
    .option("-o, --output <dir>", "Output directory", "build")
    .option("--optimize <level>", "Optimization level (0-3)", "3")
    .action(async (file, options) => {
    try {
        console.log("🔨 Compiling contracts...");
        const files = file ? [file] : await (0, helpers_1.findContractFiles)(["contracts"]);
        if (files.length === 0) {
            console.error("❌ No contract files found");
            process.exit(1);
        }
        const config = await (0, helpers_1.loadConfig)("alkali.config.json");
        const compiler = new index_1.AlkanesCompiler(config);
        for (const file of files) {
            try {
                console.log(`Compiling ${file}...`);
                await compiler.compileFile(file, {
                    optimize: options.optimize,
                    output: options.output,
                });
                console.log(`✅ Successfully compiled ${file}`);
            }
            catch (error) {
                console.error(`❌ Failed to compile ${file}:`, error);
            }
        }
    }
    catch (error) {
        console.error("❌ Compilation failed:", error);
        process.exit(1);
    }
});
program
    .command("deploy")
    .description("Deploy a compiled contract")
    .requiredOption("--wasm <file>", "WASM bytecode file")
    .requiredOption("--abi <file>", "ABI JSON file")
    .option("--args <args...>", "Constructor arguments")
    .action(async (options) => {
    try {
        // Load files
        const bytecode = await promises_1.default.readFile(options.wasm);
        const abi = JSON.parse(await promises_1.default.readFile(options.abi, "utf8"));
        // Create contract instance
        const contract = new index_1.AlkanesContract({
            bytecode: bytecode.toString("base64"),
            abi,
        });
        // Deploy
        const address = await contract.deploy(options.args || []);
        console.log(`✅ Contract deployed successfully: Address: ${address}`);
    }
    catch (error) {
        (0, helpers_1.handleCommandError)(error);
    }
});
program.parse();
//# sourceMappingURL=cli.js.map