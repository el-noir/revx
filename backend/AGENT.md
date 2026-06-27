# RE + CTF Agent

An autonomous reverse-engineering and CTF-solving agent built with the Claude Agent SDK, using Kimi as the LLM provider.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env: set ANTHROPIC_AUTH_TOKEN and GHIDRA_MCP_PATH

# 3. Run
npx ts-node agent.ts chat
```

Build the isolated analysis image before using dynamic or exploit analysis:

```bash
docker build -t re-agent-sandbox:latest -f sandbox/Dockerfile .
```

## Commands

| Command | Description |
|---------|-------------|
| `chat` | Interactive chat mode |
| `resume` | Resume the last saved session |
| `triage <binary>` | Quick binary triage (format, strings, imports, entry point) |
| `deep-dive <binary> [function]` | Deep analysis of a specific function |
| `analyze <binary>` | Full RE report saved to `<binary>.report.md` |
| `ctf <file> [description]` | Solve a CTF challenge and output the flag |
| `<binary>` | Shorthand for `analyze` |

### Interrupting a running turn

The CLI uses the Agent SDK's streaming-input mode, so you can intervene without
discarding the session:

| Control | Behavior |
|---|---|
| `/interrupt` | Interrupt the current SDK turn, then ask for a correction |
| `/steer <instruction>` | Interrupt immediately and continue with that instruction |
| `/stop` | Alias for `/interrupt` |

The interrupted query may report `error_during_execution`; the CLI treats that
as expected interrupt control flow and resumes using the same session ID.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_AUTH_TOKEN` | Yes | Kimi API key from platform.moonshot.cn |
| `ANTHROPIC_BASE_URL` | Yes | Set to `https://api.moonshot.cn/anthropic` |
| `GHIDRA_MCP_PATH` | Recommended | Path to `bridge_mcp_ghidra.py` |
| `GHIDRA_SERVER_URL` | No | Ghidra server URL (default: `http://127.0.0.1:8080/`) |
| `AGENT_CWD` | No | Working directory for files (default: `./file`) |
| `NON_INTERACTIVE` | No | Set to `1` to deny operations that require interactive approval |
| `RE_SANDBOX_IMAGE` | No | Docker image for dynamic/exploit analysis (default: `re-agent-sandbox:latest`) |

## Architecture

```
agent.ts                  ← main loop, CLI routing, permission gate, audit hook
subagent/
  static-analysis-agent.ts  ← deep static RE with Ghidra
  dynamic-analysis-agent.ts ← runtime behavior in Docker only
  osint-analysis-agent.ts   ← passive public-source intelligence
  exploit-dev-agent.ts      ← authorized PoC development in Docker
sandbox/
  index.ts                ← locked-down Docker MCP tool
.claude/
  CLAUDE.md               ← persistent agent instructions loaded every session
  skills/
    ctf-triage/           ← categorizes and routes CTF work
    static-analysis/      ← multi-function static RE workflow
    dynamic-analysis/     ← isolated runtime analysis workflow
    passive-osint/        ← passive indicator research
    exploit-development/ ← bounded authorized PoC workflow
    ghidra-triage/        ← Ghidra MCP triage workflow
    ghidra-launch/        ← binary import into Ghidra
    general-conversation/ ← non-RE chat behavior
```

## CTF capabilities

The orchestrator and four specialist subagents support:
- **Pwn:** pwntools exploit generation, ROP chain building, checksec analysis
- **Crypto:** XOR, RSA (small e, Wiener, common factor), classical ciphers, AES/DES key recovery
- **Forensics:** binwalk extraction, pcap analysis (tshark), memory dump (volatility3), foremost
- **Steganography:** steghide, zsteg, LSB analysis, exiftool, color plane inspection
- **Web:** sqlmap, ffuf directory fuzzing, injection payloads
- **Rev:** Ghidra decompilation, flag comparison tracing, XOR decode

## Required tools (install separately)

### For RE
- [Ghidra](https://ghidra-sre.org/) + [GhidraMCP](https://github.com/LaurieWired/GhidraMCP)
- `uv` (Python runner): `pip install uv`

### For CTF
```bash
pip install pwntools pycryptodome
sudo apt install binwalk foremost steghide exiftool tshark ffuf sqlmap
gem install zsteg
# SageMath (optional, for advanced crypto): https://sagemath.org
```

## Security notes

- `.env` is in `.gitignore` — never commit your API key
- All Ghidra rename/write operations require explicit confirmation
- All Bash commands and file writes are logged to `audit.log`
- Untrusted binaries are never executed on the host
- Dynamic and exploit commands require approval and run in the Docker sandbox
- `NON_INTERACTIVE=1` denies operations that require approval
