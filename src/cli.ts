#!/usr/bin/env node

import { Command } from "commander";
import { AlkanesCompiler, AlkanesContract } from "./index";
import fs from "fs/promises";
import path from "path";
import { findContractFiles, handleCommandError, loadConfig } from "./helpers";

const program = new Command();

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
      await fs.mkdir("contracts", { recursive: true });
      await fs.mkdir("build", { recursive: true });
      await fs.mkdir("scripts", { recursive: true });

      // Get template path
      const templatePath = path.join(
        __dirname,
        "..",
        "templates",
        options.template
      );

      // Check if template exists
      try {
        await fs.access(templatePath);
      } catch (err) {
        console.error(`Template "${options.template}" not found`);
        process.exit(1);
      }

      // Copy contract template
      const contractTemplatePath = path.join(
        templatePath,
        "contracts",
        "Example.rs"
      );
      const contractDest = path.join("contracts", "Example.rs");
      await fs.copyFile(contractTemplatePath, contractDest);

      // Create config file
      const configContent = {
        name: path.basename(process.cwd()),
        compiler: {
          target: "wasm32-unknown-unknown",
          optimizeLevel: 3,
        },
      };
      await fs.writeFile(
        "alkali.config.json",
        JSON.stringify(configContent, null, 2)
      );

      console.log("✅ Project initialized successfully");
      console.log("\nNext steps:");
      console.log("  1. npx alkali compile            # Compile contracts");
      console.log("  2. npx alkali test               # Run tests");
      console.log("  3. npx alkali deploy             # Deploy contracts");
    } catch (error) {
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

      const files = file ? [file] : await findContractFiles(["contracts"]);

      if (files.length === 0) {
        console.error("❌ No contract files found");
        process.exit(1);
      }

      const config = await loadConfig("alkali.config.json");

      const compiler = new AlkanesCompiler(config);

      for (const file of files) {
        try {
          console.log(`Compiling ${file}...`);
          await compiler.compileFile(file, {
            optimize: options.optimize,
            output: options.output,
          });
          console.log(`✅ Successfully compiled ${file}`);
        } catch (error) {
          console.error(`❌ Failed to compile ${file}:`, error);
        }
      }
    } catch (error) {
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
      const bytecode = await fs.readFile(options.wasm);
      const abi = JSON.parse(await fs.readFile(options.abi, "utf8"));

      // Create contract instance
      const contract = new AlkanesContract({
        bytecode: bytecode.toString("base64"),
        abi,
      });

      // Deploy
      const address = await contract.deploy(options.args || []);

      console.log(`✅ Contract deployed successfully: Address: ${address}`);
    } catch (error) {
      handleCommandError(error);
    }
  });

program.parse();
