import { query, type CanUseTool, type HookCallback, type Options } from '@anthropic-ai/claude-agent-sdk'
import dotenv from 'dotenv'
import path from 'path'
import { STATIC_ANALYSIS } from "./subagent/static-analysis-agent.js";
import { DYNAMIC_ANALYSIS } from "./subagent/dynamic-analysis-agent.js";
import { OSINT_ANALYSIS } from "./subagent/osint-analysis-agent.js";
import { EXPLOIT_DEV } from "./subagent/exploit-dev-agent.js";

import pg from 'pg'
import { PostgresSessionStore } from './session/index.js';
import { text } from 'stream/consumers';

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
const CWD = path.resolve(
 process.env.AGENT_CWD ?? process.cwd()
)

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

export const sessionStore = new PostgresSessionStore({
    pool,
    fixedProjectKey: "revcon"
})

await sessionStore.ensureSchema()

export const agentCwd = CWD

// const history: SDKUserMessage[] = []

// function userMessage(text: string): SDKUserMessage{
//     return {
//         type: 'user',
//         message: {role: 'user', content: text},
//         parent_tool_use_id: null,
//     }
// }

process.on('SIGINT', async () => {
    await pool.end()
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


   "mcp__analysis__sandbox__exec": "sandbox",

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




const handleToolRequest: CanUseTool = async (
    toolName,
    input,
    _options
) => {

    console.log(`\n[Tool Request] ${toolName}`);


    if (toolName === "Bash") {

        const cmd =
            ((input as any).command ?? "") as string;

        console.log(
            `[BASH] ${cmd.slice(0,120)}`
        );


        if (isDangerousCommand(cmd)) {
            return {
                behavior: "deny",
                message:
                  "Dangerous command blocked by security policy"
            };
        }
    }


    const policy =
        TOOL_POLICY[toolName] ?? "ask";


    const risk =
        RISK[toolName] ?? 5;



    console.log(
        `[POLICY] ${policy} | risk=${risk}`
    );



    if(policy === "deny" || risk >= 9)
    {
        return {
            behavior:"deny",
            message:
              "Tool blocked by security policy"
        };
    }


    if(policy === "allow" && risk <= 3)
    {
        return {
            behavior:"allow",
            updatedInput: input
        };
    }


    if(policy === "sandbox")
    {
        return {
            behavior:"allow",
            updatedInput:{
                ...(input as any),
                timeout:300,
                network:false
            }
        };
    }

    if(toolName === 'AskUserQuestion'){
        const answers = await AskUserQuestion(input);
        return {
            behavior: "allow",
            updatedInput: {
                questions: (input as any).questions,
                answers: answers
            }
        };
    }


    const approved =
        await askApproval(
            `Allow ${toolName}?`
        );


    if(approved)
    {
        return {
            behavior:"allow",
            updatedInput:input
        };
    }


    return {
        behavior:"deny",
        message:"User denied permission"
    };
};

export let currentSocket: any = null;

async function askApproval(question: string): Promise<boolean> {
    if (!currentSocket) return false;
    return new Promise((resolve) => {
        currentSocket.emit('ask_permission', { question });
        currentSocket.once('permission_response', (answer: boolean) => {
            resolve(answer);
        });
    });
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
        return content.map((c:any)=> {
            if(c.type=== 'text') return c.text;
            if(c.type === 'tool_use') {
                if(c.name=== 'Agent' || c.name === 'Task'){
                    const subType = c.input?.subagent_type ?? c.input?.agent ?? 'unknow';
                    return `\n [Dispatching Subagent: ${subType}]`
                }
                 return `\n [Calling Tool: ${c.name}]`;
            }
            return ''
        }).filter(Boolean).join('\n')
    }
    return ''
}

async function AskUserQuestion(input: any): Promise<any> {
    if(!currentSocket) return {};

    return new Promise((resolve)=> {
        currentSocket.emit('ask_user_question', input); 
        currentSocket.once('question_response', (answers: any) =>{
            resolve(answers);
        })
    })
}


const ghidraGuard: HookCallback = async (input) => {

    if(
        input.hook_event_name !== "PreToolUse"
    ){
        return {};
    }


    const tool =
        input.tool_name;


    console.log(
        `[GHIDRA CHECK] ${tool}`
    );



    const dangerous =
    [
        "delete",
        "import",
        "create_project",
        "execute_script",
        "patch"
    ];



    if(
        dangerous.some(x =>
            tool.includes(x)
        )
    )
    {

        return {

            hookSpecificOutput:
            {
                hookEventName:
                    "PreToolUse",

                permissionDecision:
                    "deny",

                permissionDecisionReason:
                    `Blocked dangerous Ghidra operation: ${tool}`
            }
        };
    }



    return {};
};

 const ghidraResultCollector: HookCallback = async (
    input
)=>{


    if(
        input.hook_event_name !== "PostToolUse"
    ){
        return {};
    }


    if(
        input.tool_name !==
        "mcp__ghidra__decompile_function"
    ){
        return {};
    }



    const response =
        input.tool_response as any;



    const functionName =
        (input.tool_input as any)?.function ??
        (input.tool_input as any)?.name ??
        "unknown";



    const output =
        typeof response?.content === "string"
        ?
        response.content
        :
        JSON.stringify(
            response?.content ??
            response
        );



    console.log(
        "\n[FINDING]"
    );


    console.log(
        `Function: ${functionName}`
    );


    console.log(
        output.slice(0,300)
    );

    return {};
};


const options: Options = {
        cwd: CWD!,
        systemPrompt: SYSTEM_PROMPT,
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
        
 "mcp__ghidra__list_*",
 "mcp__ghidra__decompile_function",
 "mcp__ghidra__disassemble_function",
],

//     disallowedTools:[
//   "mcp__ghidra__rename_function",
//   "mcp__ghidra__rename_variable",
//   "mcp__ghidra__set_comment",
//   "mcp__ghidra__import_binary"
// ],

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

hooks:{
    PreToolUse:[
        {
            matcher:"mcp__ghidra__*",
            hooks:[
                ghidraGuard
            ]
        }
    ],

    PostToolUse:[
        {
            matcher:
              "mcp__ghidra__decompile_function",

            hooks:[
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
    // model: "kimi-k2.6",
    model: "openrouter/free"
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


export async function runAgentQuery(
    prompt: string | undefined,
    sessionId: string | undefined,
    socket: any,
    onSessionInit?: (sid: string) => void,
    projectKey?: string
) {
    currentSocket = socket;
    const queryOptions: Options = {
        ...options,
        ...(sessionId ? {resume: sessionId} : {})
    };

    if (sessionId) {
        const entries = await sessionStore.load({
            projectKey: projectKey || options.cwd!,
            sessionId
        });
        if (!entries) {
            socket.emit('agent_message', { type: 'error', text: `Session "${sessionId}" not found in database. Starting fresh.` });
            
            delete queryOptions.resume;
        }
    }

    try {
        const queryParams: any = {options: queryOptions};
        if(prompt) queryParams.prompt = prompt;

            for await (const message of query(queryParams)){
            if(message.type === 'system'){

                if(message.subtype === 'init'){
                    onSessionInit?.(message.session_id);
                } else if(message.subtype === 'task_started'){
                    socket.emit('agent_message', {type: 'system', text: `[Task Started] ${message.description} (Task ID: ${message.task_id.slice(-8)})` 
                })
                } else if(message.subtype === 'task_progress'){
                    socket.emit('agent_message', {type: 'system', text: `[Task Progress] ${message.description}`});
                }
                else if(message.subtype === 'task_notification'){
                    socket.emit('agent_message', { type: 'system', text: `[Task ${message.status}] Task ID: ${message.task_id.slice(-8)}` });
                }
                
            }   else if(message.type === 'stream_event'){
                    const event = (message as any).event;

                    if(event?.type === 'content_block_delta' && event.delta?.type === 'text_delta'){
                        socket.emit('agent_stream', {text: event.delta.text});
                    }

                    else if(event?.type === 'content_block_start' && event.content_block?.type ==='tool_use'){
                        const c = event.content_block;
                        const toolText = `\n\n [Calling Tool: ${c.name}]\n\n`;

                        socket.emit('agent_stream', {text: toolText});
                    }
                } 

            else if (message.type === 'assistant') {
                // const text = extractText(message.message.content);
                // if (text) {
                //     socket.emit('agent_message', { type: 'assistant', text });
                // }
            } else if (message.type === 'user' && (message as any).tool_use_result) {
                socket.emit('agent_message', { type: 'tool', text: formatToolResponse((message as any).tool_use_result) });
            } else if (message.type === 'result') {
                socket.emit('agent_message', { type: 'result', text: message.subtype });
            }
        }
    } catch (err: any) {
        console.error('[runAgentQuery] Error:', err);
        socket.emit('agent_message', { type: 'error', text: err?.message || String(err) });
    } finally {
        socket.emit('agent_done');
    }
}