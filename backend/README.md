# RevX

Autonomous reverse-engineering and CTF-solving agent built on the Claude Agent SDK.

---

## What it does

RevX orchestrates a set of specialized subagents to analyze binaries, solve CTF challenges, and produce structured reports — all from a single interactive CLI session. It integrates directly with Ghidra via MCP for decompilation and static analysis, and delegates runtime behavior, OSINT lookups, and exploit development to purpose-built subagents.

Every tool call that touches Ghidra or executes a binary goes through an explicit human-approval gate before it runs.

---

## Architecture

```
User (CLI)
    │
    ▼
Orchestrator  ──  Kimi K2 via Claude Agent SDK
    │
    ├── GhidraGuard hook  (read-only enforcement on mcp__ghidra__*)
    ├── canUseTool gate   (interactive y/n approval)
    └── Skills: ctf-triage · reverse-triage · ghidra-triage · reporting · …
         │
         ├── [Agent] Static analysis     → Ghidra MCP (stdio)
         ├── [Agent] Dynamic analysis    → Docker sandbox
         ├── [Agent] OSINT analysis      → Tavily MCP (HTTP)
         └── [Agent] Exploit dev         → Docker sandbox + Ghidra MCP
                                                │
                                         Binary / target (read-only on host)
```

---

## Stack

| Layer | Technology |
|---|---|
| Agent runtime | `@anthropic-ai/claude-agent-sdk` |
| LLM | Kimi K2 (`kimi-k2.6`) |
| Decompiler | Ghidra + GhidraMCP bridge (stdio) |
| OSINT | Tavily MCP (remote HTTP) |
| Sandbox | Docker (isolated exec — no host execution) |
| Language | TypeScript / Node.js |

---

## Subagents

**Static analysis** — multi-function decompilation, call graphs, data flow. Uses Ghidra MCP read-only tools and preloaded skills. Max 45 turns, high effort.

**Dynamic analysis** — runtime tracing and behavioral observation inside a Docker sandbox. Networking disabled by default. Max 35 turns, high effort.

**OSINT analysis** — passive indicator lookups via Tavily (hash, domain, IP, cert, malware family). No active probing. Max 25 turns, medium effort.

**Exploit dev** — PoC development for authorized CTF and defensive research only. Requires explicit vulnerability evidence and authorization in the delegation prompt. Max 50 turns, high effort.

---

## Setup

```bash
npm install

# Required environment variables
ANTHROPIC_API_KEY=...
ANTHROPIC_TAVILY_API_KEY=...
GHIDRA_MCP_PATH=/path/to/bridge_mcp_ghidra.py   # default: ~/Downloads/GhidraMCP-release-1-4/...
GHIDRA_SERVER_URL=http://127.0.0.1:8080/          # default
AGENT_CWD=/path/to/working/directory

npm run start
```

Ghidra must be running and the REST server enabled before starting the agent.

---

## Safety

- Ghidra write tools (`rename_function`, `rename_variable`, `set_comment`, `import_binary`) are disallowed at the SDK level.
- Every other Ghidra tool call passes through `GhidraGuard`, which auto-allows read-only tools and denies everything else.
- All binary execution happens inside Docker — never on the host.
- Every tool call (Bash, Ghidra, file writes) requires explicit `y` confirmation from the user before it runs.

---

## Modes

| Mode | Trigger | Behavior |
|---|---|---|
| Conversational | Default | Q&A, code help, file reading |
| RE mode | "analyze this binary" | Triage-first: `file` → `strings` → Ghidra phase → deep analysis |
| CTF mode | CTF challenge provided | Recon → category detection → subagent delegation → flag output |

---

## Output formats

**RE report** — file metadata, capabilities, key functions table, suspicious indicators, strings of interest, conclusion.

**CTF solution** — challenge name, category, one-paragraph approach, flag (`🚩 FLAG: ...`), written to `solution.flag`.
