# World AgentKit Template

A minimal but complete implementation of the [World AgentKit integration guide](https://docs.world.org/agents/agent-kit/integrate).

## What this demonstrates

| Step | Component | Description |
|------|-----------|-------------|
| 1 | `src/server.ts` | Hono server with a protected `/data` endpoint |
| 2 | `src/server.ts` | `createAgentkitHooks` enforces a 3-use free-trial per registered human |
| 3 | `src/agent.ts` | Agent builds a SIWE message, signs it, and sends the `X-AgentKit` header |
| 4 | Both | First 3 requests succeed; the 4th returns 402 (trial exhausted) |

### Workflow

```
Agent                             Server                      World Chain
  |                                  |                              |
  |-- GET /data + X-AgentKit ------> |                              |
  |                                  |-- lookupHuman(address) ----> |
  |                                  |<- humanId ------------------- |
  |                                  | (free trial: 1/3 used)       |
  |<-- 200 { data } ----------------- |                              |
  ...
  |-- GET /data + X-AgentKit ------> | (3/3 uses exhausted)
  |<-- 402 { payment required } ---- |
```

## Quick start

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Generate an agent private key:

```bash
bun -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

Derive the address (viem):

```bash
bun -e "
const { privateKeyToAccount } = require('viem/accounts');
const a = privateKeyToAccount('0x<your-key>');
console.log(a.address);
"
```

Edit `.env` and set `AGENT_PRIVATE_KEY`.

### 3. Register your agent (once)

```bash
bunx @worldcoin/agentkit-cli register <agent-address>
```

The CLI prompts you to verify with World App, then submits the registration
transaction to World Chain.

### 4. Start the server

```bash
bun run dev:server
```

Output:

```
 World AgentKit Demo Server
 Listening on http://localhost:3000
 Protected endpoint: GET http://localhost:3000/data
 Free-trial uses: 3 per registered human
```

### 5. Run the agent demo (separate terminal)

```bash
bun run dev:agent
```

Expected output:

```
--- Request #1 ---   → 200  (free trial 1/3)
--- Request #2 ---   → 200  (free trial 2/3)
--- Request #3 ---   → 200  (free trial 3/3)
--- Request #4 ---   → 402  (trial exhausted — payment required)
```

## Project layout

```
.
├── src/
│   ├── server.ts   # Hono server + AgentKit hooks + 402 enforcement
│   └── agent.ts    # Agent wallet + SIWE signing + demo loop
├── .env.example
├── package.json
└── tsconfig.json
```

## Key constants (World Chain)

| Name | Value |
|------|-------|
| Chain ID (CAIP-2) | `eip155:480` |
| World USDC | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` |
| AgentBook contract | `0xA23aB2712eA7BBa896930544C7d6636a96b944dA` |
| Default facilitator | `https://x402-worldchain.vercel.app/facilitator` |

## Production checklist

- [ ] Replace `InMemoryAgentKitStorage` with a database-backed implementation
  (implement `getUsageCount`, `incrementUsage`, `hasUsedNonce`, `recordNonce`)
- [ ] Set `PAY_TO` to your actual payment address
- [ ] Integrate real x402 payment verification for the post-trial flow
- [ ] Load `AGENT_PRIVATE_KEY` from a secrets manager (e.g. AWS Secrets Manager)
- [ ] Set `BASE_URL` to your public domain

## References

- [Integration guide](https://docs.world.org/agents/agent-kit/integrate)
- [SDK reference](https://docs.world.org/agents/agent-kit/sdk-reference)
- [x402 protocol](https://x402.org)
