import {query} from '@anthropic-ai/claude-agent-sdk'
import dotenv from 'dotenv'

const SYSTEM_PROMPT= "You are a reverse engineering agent and you have access to ghidra mcp."

const GHIDRA_MCP_PATH = process.env.GHIDRA_MCP_PATH ?? "/home/el-noir/Downloads/GhidraMCP-release-1-4/bridge_mcp_ghidra.py";
const GHIDRA_SERVER_URL = process.env.GHIDRA_SERVER_URL ?? "http://127.0.0.1:8080/";
const CWD = process.env.AGENT_CWD

dotenv.config()

for await(const message of query({
    prompt: `Check if ghidra mcp is working`,
    options: {
        cwd: CWD,


        allowedTools: [
            "Agent",
            "Read",
            "Glob",
            "Grep",
            "Bash",
            "AskUserQuestion",
                "mcp__ghidra__list_functions",
    "mcp__ghidra__list_imports",
    "mcp__ghidra__list_exports",
    "mcp__ghidra__list_strings",
    "mcp__ghidra__decompile_function",
    "mcp__ghidra__decompile_function_by_address",
    "mcp__ghidra__disassemble_function",
    "mcp__ghidra__get_xrefs_to",
    "mcp__ghidra__get_xrefs_from",
    "mcp__ghidra__rename_function",
    "mcp__ghidra__rename_variable",
    "mcp__ghidra__set_comment",
    "mcp__ghidra__import_binary",
    "mcp_ghidra__*"
        ],

        mcpServers: {
            ghidra: {
                command: "uv",
                args: [
                    "run",
                    GHIDRA_MCP_PATH,
                    "--ghidra-server",
                    GHIDRA_SERVER_URL,
                    "--transport",
                    "stdio",
                ]
            }
        },

        model: "kimi-k2.6",

        // permissionMode: "bypassPermissions"
    }
})){
    console.log(message);
}
