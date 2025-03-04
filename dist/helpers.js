"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCommandError = handleCommandError;
exports.loadConfig = loadConfig;
exports.findContractFiles = findContractFiles;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
function handleCommandError(error) {
    if (error instanceof Error) {
        console.error("❌ Command failed:", error.message);
    }
    else {
        console.error("❌ Command failed:", error);
    }
    process.exit(1);
}
async function loadConfig(configPath) {
    try {
        const configContent = await promises_1.default.readFile(configPath, "utf8");
        return JSON.parse(configContent);
    }
    catch (error) {
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
async function findContractFiles(sources) {
    const files = [];
    for (const source of sources) {
        const stat = await promises_1.default.stat(source);
        if (stat.isDirectory()) {
            // Read all .rs files in directory
            const entries = await promises_1.default.readdir(source, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith(".rs")) {
                    files.push(path_1.default.join(source, entry.name));
                }
            }
        }
        else if (source.endsWith(".rs")) {
            files.push(source);
        }
    }
    return files;
}
//# sourceMappingURL=helpers.js.map