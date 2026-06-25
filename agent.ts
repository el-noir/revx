import {type SDKUserMessage, query, type CanUseTool, type HookCallback} from '@anthropic-ai/claude-agent-sdk'
import dotenv from 'dotenv'
import { permission } from 'process';
import * as readline from "readline/promises";

const SYSTEM_PROMPT= "You are a reverse engineering agent and you have access to ghidra mcp."

const GHIDRA_MCP_PATH = process.env.GHIDRA_MCP_PATH ?? "/home/el-noir/Downloads/GhidraMCP-release-1-4/bridge_mcp_ghidra.py";
const GHIDRA_SERVER_URL = process.env.GHIDRA_SERVER_URL ?? "http://127.0.0.1:8080/";
const CWD = process.env.AGENT_CWD

dotenv.config()

// const history: SDKUserMessage[] = []

// function userMessage(text: string): SDKUserMessage{
//     return {
//         type: 'user',
//         message: {role: 'user', content: text},
//         parent_tool_use_id: null,
//     }
// }

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

const handleToolRequest: CanUseTool = async (toolName, input, _options) => {
    console.log(`\n[Tool Req]: ${toolName}`);

    if(toolName === "Bash"){
        console.log(`Command: ${(input as any).command}`);
        if((input as any).description) console.log(`Description: ${(input as any).description}`)
    } else 
{
    console.log(`Input: ${JSON.stringify(input, null, 2)}`);
}

    const response = await rl.question("Allow this actions? (y/n)");

    if (response?.trim().toLowerCase() === "y") {
        return {behavior: "allow", updatedInput: input}
    } else{
        return {behavior: "deny", message: "User denied this action"};
    }
   
}

function extractText(content: any): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
        return content
            .map((c: any) => c.text ?? '')
            .join('')
    }
    return ''
}

const ghidraGuard: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return {}

    const tool = input.tool_name
    console.log("[GhidraGuard] checking:", tool)

    const readonly = [
        "mcp__ghidra__list_functions",
        "mcp__ghidra__list_imports",
        "mcp__ghidra__list_exports",
        "mcp__ghidra__list_strings",
        "mcp__ghidra__list_segments",
        "mcp__ghidra__decompile_function",
        "mcp__ghidra__disassemble_function",
        "mcp__ghidra__get_xrefs_to",
        "mcp__ghidra__get_xrefs_from",
    ]

    const decision: 'allow' | 'deny' = readonly.includes(tool) ? 'allow' : 'deny'

    return {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: decision,
            permissionDecisionReason: decision === 'allow'
                ? 'Read-only Ghidra tool'
                : 'Ghidra modifications are disabled',
        },
    }
}


const options = {
        cwd: CWD,
    canUseTool: handleToolRequest,
    allowedTools: [
        "Skill",
        "Agent",
        "Read",
        "Glob",
        "Grep",
        "AskUserQuestion",
        "mcp__ghidra__*"
    ],

    disallowedTools:[
  "mcp__ghidra__rename_function",
  "mcp__ghidra__rename_variable",
  "mcp__ghidra__set_comment",
  "mcp__ghidra__import_binary"
],

    skills: [
      "general-conversation",
      "ctf-triage",
      "ctf-solving",
      "reverse-triage",
      "deep-decompilation",
      "reporting",
      "ghidra-launch",
      "ghidra-triage",
      "advanced-decoder",
    ],

    hooks: {
        PreToolUse:[
            {
                matcher: "mcp_ghidra__*",
                hooks:[
                    ghidraGuard
                ]
            }
        ]
    },

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
    continue: true,  
}

function extractToolResults(message: any): string {
    if(message.type === 'result'){
        return message.result ?? ''
    }
    if(message.type === 'user' && message.tool_use_result)
    {
        return JSON.stringify(message.tool_use_result).slice(0, 2000)
    }
    return ''
}

function formatToolMeta(message: any): string {
    if (!message.tool_use_meta?.length) return ''
    return message.tool_use_meta
        .map((m: any) => `[Calling tool: ${m.display_name ?? m.id}]`)
        .join(' ')
}


async function main(){
    let transcript = `System: ${SYSTEM_PROMPT}\n`

    
while(true){
    const userInput = await rl.question('You: ')

    if(!userInput.trim()) continue
    if(userInput.trim().toLowerCase() === 'exit') break

    const prompt = `${transcript}\nUser: ${userInput}\n Assistant:`

    let reply = ''


    
for await (const message of query({
    prompt, options
    
})) {
    if(message.type === 'assistant'){
        const toolMeta = formatToolMeta(message.message);

        const text = extractText(message.message.content)
        if(text){
                    reply +=text;
        process.stdout.write(text);
        }
    }

            if (message.type === 'result') {
                console.log(`\n[Tool result]: ${JSON.stringify(message.result).slice(0, 1000)}`)
                reply += `\n[Tool result]: ${message.result}`
            }


}
  console.log()
transcript += `\nUser: ${userInput}\nAssistant: ${reply}`


}
rl.close()


}


main().catch((err)=>{
    console.log(err)
    process.exit(1)
})