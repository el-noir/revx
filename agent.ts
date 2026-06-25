import { query, type CanUseTool, type HookCallback} from '@anthropic-ai/claude-agent-sdk'
import dotenv from 'dotenv'
import { permission } from 'process';
import * as readline from "readline/promises";

import { STATIC_ANALYSIS } from "./subagent/static-analysis-agent.js";
import { DYNAMIC_ANALYSIS } from "./subagent/dynamic-analysis-agent.js";
import { OSINT_ANALYSIS } from "./subagent/osint-analysis-agent.js";
import { EXPLOIT_DEV } from "./subagent/exploit-dev-agent.js";

import pg from 'pg'
import {PostgresSessionStore} from './session/index.js'

const {Pool} = pg;

dotenv.config()

const SYSTEM_PROMPT= "You are a reverse engineering agent and you have access to ghidra mcp."

const GHIDRA_MCP_PATH = process.env.GHIDRA_MCP_PATH ?? "/home/el-noir/Downloads/GhidraMCP-release-1-4/bridge_mcp_ghidra.py";
const GHIDRA_SERVER_URL = process.env.GHIDRA_SERVER_URL ?? "http://127.0.0.1:8080/";
const CWD = process.env.AGENT_CWD

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

const sessionStore = new PostgresSessionStore({pool})
await sessionStore.ensureSchema()

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

process.on('SIGINT', async () => {
    await pool.end()
    rl.close()
    process.exit(0)
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
    sessionStore,

    includePartialMessages: true,
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

    agents: {
        static_analysis: STATIC_ANALYSIS,
        dynamic_analysis: DYNAMIC_ANALYSIS,
        osint_analysis: OSINT_ANALYSIS,
        exploit_dev: EXPLOIT_DEV,
    },

    hooks: {
        PreToolUse:[
            {
                matcher: "mcp__ghidra__*",
                hooks:[
                    ghidraGuard
                ]
            }
        ]
    },

    mcpServers: {
        "tavily-remote-mcp": {
        type: "http",
        url: `https://mcp.tavily.com/mcp/?tavilyApiKey=${process.env.ANTHROPIC_TAVILY_API_KEY}`,
        alwaysLoad: true,
      },
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

async function main() {
    let transcript = `System: ${SYSTEM_PROMPT}\n`

    console.log("=== Revcon===")

    while (true) {
        const userInput = await rl.question('You: ')
        if (!userInput.trim()) continue
        if (userInput.trim().toLowerCase() === 'exit') break

        const prompt = `${transcript}\nUser: ${userInput}\nAssistant:`
        let reply = ''

        let inTool = false
        let currentToolName = ''
        let currentToolInput = ''
        
   for await (const message of query({prompt, options})) {
    switch (message.type) {
        case 'system': {
            if (message.subtype === 'init') {
                console.log(`[SESSION] ${message.session_id}`)
            } else if (message.subtype === 'status') {
                console.log(`[STATUS] ${message.data != null ? JSON.stringify(message.data).slice(0, 200) : '(no data)'}`)
            }
            break
        }

        case 'stream_event': {
            const event = message.event as any
            if (!event) break

            if (event.type === 'content_block_start') {
                if (event.content_block?.type === 'tool_use') {
                    currentToolName = event.content_block.name ?? 'tool'
                    currentToolInput = ''
                    inTool = true
                    process.stdout.write(`\n[TOOL START] ${currentToolName}\n`)
                }
            } else if (event.type === 'content_block_delta') {
                if (event.delta?.type === 'text_delta' && !inTool) {
                    const chunk = event.delta.text ?? ''
                    reply += chunk
                    process.stdout.write(chunk)
                } else if (event.delta?.type === 'input_json_delta') {
                    currentToolInput += event.delta.partial_json ?? ''
                }
            } else if (event.type === 'content_block_stop') {
                if (inTool) {
                    console.log(`[TOOL INPUT] ${currentToolName}`)
                    console.log(JSON.stringify(currentToolInput, null, 2))
                    inTool = false
                    currentToolName = ''
                    currentToolInput = ''
                }
            }
            break
        }

        case 'assistant': {
            const text = extractText(message.message.content)
            if (text && !reply.includes(text)) {
                reply += text
                process.stdout.write(text)
            }
            break
        }

        case 'user': {
            const toolResult = (message as any).tool_use_result
            if (toolResult) {
                console.log(`[TOOL RESULT]`)
                console.log(JSON.stringify(toolResult, null, 2).slice(0, 30))
            }
            break
        }

        case 'result': {
            const resultText = typeof message.result === 'string'
                ? message.result
                : JSON.stringify(message.result)
            console.log(`\n[DONE] ${message.subtype}`)

            break
        }

        case 'permission_denied': {
            console.log(`[DENIED] ${message.tool_name}`)
            break
        }

        case 'mirror_error': {
            console.log(`[MIRROR ERROR] ${JSON.stringify(message.data).slice(0, 300)}`)
            break
        }

        case 'notification': {
            console.log(`[NOTE] ${JSON.stringify(message.data).slice(0, 300)}`)
            break
        }

        default: {
            console.log(`[${message.type}]`)
        }
    }
}
        

        console.log()
        transcript += `\nUser: ${userInput}\nAssistant: ${reply}`
    }

    rl.close()
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})