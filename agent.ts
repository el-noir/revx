import {query, type CanUseTool} from '@anthropic-ai/claude-agent-sdk'
import dotenv from 'dotenv'
import * as readline from "readline";

const SYSTEM_PROMPT= "You are a reverse engineering agent and you have access to ghidra mcp."

const GHIDRA_MCP_PATH = process.env.GHIDRA_MCP_PATH ?? "/home/el-noir/Downloads/GhidraMCP-release-1-4/bridge_mcp_ghidra.py";
const GHIDRA_SERVER_URL = process.env.GHIDRA_SERVER_URL ?? "http://127.0.0.1:8080/";
const CWD = process.env.AGENT_CWD

dotenv.config()

async function handleToolRequest(toolName, input, _options){
    console.log(`\nTool: ${toolName}`);

    if(toolName === "Bash"){
        console.log(`Command: ${(input as any).command}`);
        if((input as any).description) console.log(`Description: ${(input as any).description}`)
    } else 
{
    console.log(`Input: ${JSON.stringify(input, null, 2)}`);
}

    const response = await prompt("Allow this actions? (y/n)");

    if (response?.trim().toLowerCase() === "y") {
        return {behavior: "allow", updatedInput: input}
    } else{
        return {behavior: "deny", message: "User denied this action"};
    }
}

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve)=>
        rl.question(question, (answer)=>{
            rl.close();
            resolve(answer);
        })
    )
}

for await (const message of query({
    prompt: `Check if ghidra mcp is working, and check if util file exist or not, through bash`,
    options: {
        cwd: CWD,

        // Wire the terminal permission handler
        canUseTool: handleToolRequest,

        allowedTools: [
            "Agent",
            "Read",
            "Glob",
            "Grep",
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
            "mcp__ghidra__*",
        ],

        mcpServers: { ghidra: { ... } },
        model: "kimi-k2.6",
    }
})) {
    console.log(message);
}
