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
import { time } from 'console';

const {Pool} = pg;

dotenv.config()

const SYSTEM_PROMPT= `You are the adaptive orchestrator for an autonomous reverse-engineering and CTF-solving agent.

## Modes
- **General:** Answer questions, help with code/files. Do not invoke RE or CTF tools unless asked.
- **RE mode:** Perform bounded triage directly, then delegate specialist work.
- **CTF mode:** Categorize and triage first. Solve simple discoveries directly; delegate complex work.

## Complexity decision
Handle easy, bounded tasks directly: conversation, coding questions, file identification, hashes,
strings, headers, imports, simple single-step decoding, one straightforward Ghidra function, and
summaries of existing findings.

Delegation is mandatory for:
- static_analysis: multi-function analysis, call graphs, deep decompilation, or malware capabilities.
- dynamic_analysis: debugging, tracing, behavioral observation, or any artifact execution.
- osint_analysis: public reputation, attribution, or indicator research.
- exploit_dev: vulnerability validation, exploit construction, or payload testing.

## Behaviour
- Be concise. Act, do not narrate.
- For greetings or general questions, respond naturally.
- Never use a specialist merely to repeat easy triage that you can safely perform yourself.
- Use Ghidra MCP tools (mcp__ghidra__*) for static binary analysis.
- If a task benefits from a subagent, use the Agent tool.
- When invoking subagents, ALWAYS include in the prompt:
    • Absolute path to the artifact
    • User objective and authorization constraints
    • Verified findings so far, including relevant raw output
    • The exact question to answer
    • The expected response structure
- If you need clarification, use AskUserQuestion.

## Rules
- Never execute untrusted binaries on the host. Runtime work belongs to dynamic_analysis or
  exploit_dev and must use the Docker analysis sandbox.
- Always verify before reporting. Decompile functions; do not guess.
- Rename Ghidra functions/variables as you understand them.
- Report uncertainty explicitly. Do not fabricate analysis.
- When you find a CTF flag matching flag{...} or CTF{...} patterns, highlight it clearly as: 🚩 FLAG: <value>`

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

type PolicyAction = "allow" | "ask" | "deny" | "sandbox"

const TOOL_POLICY: Record<string, PolicyAction> = {
       Read: "allow",
    Glob: "allow",
   Grep: "allow",
    Agent: "allow",
   Skill: "allow",
   AskUserQuestion: "allow",


   "mcp_analysis_sandbox_exec": "sandbox",

     Bash: "ask",

      "mcp__ghidra__list_functions": "allow",
    "mcp__ghidra__list_imports": "allow",
    "mcp__ghidra__list_exports": "allow",
    "mcp__ghidra__list_strings": "allow",
    "mcp__ghidra__list_segments": "allow",
    "mcp__ghidra__decompile_function": "allow",
    "mcp__ghidra__disassemble_function": "allow",
    "mcp__ghidra__get_xrefs_to": "allow",
    "mcp__ghidra__get_xrefs_from": "allow",

    "mcp__ghidra__rename_function": "ask",
    "mcp__ghidra__rename_variable": "ask",
    "mcp__ghidra__set_comment": "ask",
}

const RISK: Record<string, number> = {
    Read: 0,
    Glob: 0,
    Grep: 0,
    Agent: 0,
    Skill: 1,

    "mcp_analysis_sandbox_exec": 4,

    Bash: 7,

        "mcp__ghidra__list_strings": 0,
    "mcp__ghidra__decompile_function": 1,
    "mcp__ghidra__rename_function": 3,
    "mcp__ghidra__import_binary": 9,
}

const DANGEROUS_PATTERNS = [
    "rm -rf",
    "shutdown",
    "mkfs",
    ":(){",
    "dd if=",
    "> /dev/",
    "chmod -R 777 /",
    "curl .*\\| sh",
];

function isDangerousCommand(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern)=>
    new RegExp(pattern, "i").test(command))
}




const handleToolRequest: CanUseTool = async (toolName, input, _options) => {
    console.log(`\n[Tool Req]: ${toolName}`);

    if (toolName === "Bash") {
        const cmd = ((input as any).command ?? "") as string;
        const preview = cmd.length > 120 ? cmd.slice(0, 120) + "..." : cmd;
        console.log(`Command: ${preview}`);
        if ((input as any).description) {
            console.log(`Description: ${(input as any).description}`);
        }
    } 
    else {
        const jsonInput = JSON.stringify(input, null, 2);
        const firstLine = jsonInput.split("\n")[0];
        console.log(`Input: ${firstLine}`);
    }

    if (toolName === "mcp__analysis_sandbox__exec") {
        return { behavior: "allow", updatedInput: input };
    }

        if (toolName === "Bash") {
        return { behavior: "allow", updatedInput: input };
    }

        if (
        toolName.startsWith("mcp__ghidra__") &&
        !["rename_", "set_", "add_", "create_", "delete_", "import_"].some((op) =>
            toolName.includes(op)
        )
    ) {
        return { behavior: "allow", updatedInput: input };
    }

    if (
        ["Read", "Glob", "Grep", "Agent", "Skill"].includes(toolName) ||
        toolName.startsWith("mcp__tavily_remote_mcp__")
    ) {
        return { behavior: "allow", updatedInput: input };
        
        if(isDangerousCommand(cmd)){
            return{
                behavior: 'deny',
                message: "Dangerous Bash command blocked by policy",
            };
        }

    } else {
        const jsonInput = JSON.stringify(input, null, 2);
        const firstLine = jsonInput.split("\n")[0];
        console.log(`Input: ${firstLine}`)
    }

    

    const policy = TOOL_POLICY[toolName] ?? "ask";
    const risk = RISK[toolName] ?? 5;

    if(policy === "deny" || risk >= 7){
        return {behavior: "deny", message: "Blocked by policy"};
    }

    if(policy === "sandbox"){
        return {
            behavior: "allow",
            updatedInput: {
                ...input,
                timeout: 300,
                network: false,
            }
        }
    }

    const ok = await askApproval(`Allow ${toolName}`);

    if(ok){
        return {behavior: "allow", updatedInput: input};
    }
    return {behavior: "deny", message: "User denied this action"};

    
}

async function askApproval(question: string): Promise<boolean> {
    const answer = await rl.question(`${question} (y/n) `)
    return answer.trim().toLowerCase().startsWith('y')
}

function formatToolResponse(toolResult: any): string {
    const isError = toolResult?.is_error || toolResult?.error
    const prefix = isError ? '[TOOL ERROR]' : '[TOOL OK]'
    let text: string
    if (typeof toolResult?.content === 'string') {
        text = toolResult.content
    } else if (toolResult?.content != null) {
        text = JSON.stringify(toolResult.content)
    } else {
        text = JSON.stringify(toolResult)
    }
    const preview = text.split('\n').slice(0, 3).join(' ').slice(0, 200)
    return `${prefix} ${preview}${text.length > 200 ? '...' : ''}`
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
    console.log(`[Ghidra] ${tool}`)

    if (
        tool.includes("import") ||
        tool.includes("delete") ||
        tool.includes("create_project")
    ) {
        return {
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: "Destructive Ghidra operation blocked",
            },
        };
    }
    return {};
  }


  const ghidraResultCollector: HookCallback = async (input) =>{
    if(input.hook_event_name !=="PostToolUse") return {};

    if (input.tool_name !== "mcp__ghidra__decompile_function") return {};

    const response = input.tool_response as any;

    const functionName = (input.tool_input as any)?.function ??
    (input.tool_input as any)?.name ??
    "unknown";

    const output = typeof response?.content === "string"
            ? response.content
            : JSON.stringify(response?.content ?? response);

    console.log(
       `[FINDING] ${functionName}: ${output.slice(0, 120)}${output.length > 120 ? "..." : ""}`
    )

    return {}
  }


const options = {
        cwd: CWD,
    canUseTool: handleToolRequest,
    sessionStore,

        CLAUDE_CODE_ENABLE_TELEMETRY: "1",

    CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1",

    OTEL_TRACES_EXPORTER: "otlp",
    OTEL_METRICS_EXPORTER: "otlp",
    OTEL_LOGS_EXPORTER: "otlp",

    OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
    OTEL_EXPORTER_OTLP_ENDPOINT:
      "http://localhost:4318",

    OTEL_SERVICE_NAME: "revcon-agent",

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
        ],
        PostToolUse: [
            {
                matcher: "mcp_ghidra_decompile_function",
                hooks: [
                    ghidraResultCollector
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

        for await (const message of query({prompt, options})) {
            switch (message.type) {
                case 'system': {
                    if (message.subtype === 'init') {
                        console.log(`[SESSION] ${message.session_id}`)
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
                        console.log(formatToolResponse(toolResult))
                    }
                    break
                }

                case 'result': {
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