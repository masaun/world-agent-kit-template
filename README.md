# World AgentKit Template

## Overview

This repo is the template for the `World AgentKit` integration by referencing the [World AgentKit integration guide](https://docs.world.org/agents/agent-kit/integrate).



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

Edit `.env` and set `AGENT_PRIVATE_KEY`.
```bash
AGENT_PRIVATE_KEY="0xYourPrivateKeyHere"
```

### 3. Register your agent (once)

Register your `<agent-wallet-address>`, which is public key of the `AGENT_PRIVATE_KEY` that you set the step 2 above.
```bash
bunx @worldcoin/agentkit-cli register <agent-wallet-address>
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

- [World AgentKit integration guide](https://docs.world.org/agents/agent-kit/integrate)
- [SDK reference](https://docs.world.org/agents/agent-kit/sdk-reference)
- [x402 protocol](https://x402.org)

<br>

<hr>

## Extra - How to generate a public key/private key pair for testing purpose 

1/ Generate an agent `private key`:
```bash
bun -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

2/ Derive an agent `wallet address` (`public key`) with a generated `privat key` above using `viem`:
   
```bash
# NOTE: You need to set "0x<your-private-key>" to the privateKeyToAccount() below - before executing the following code.
bun -e "
const { privateKeyToAccount } = require('viem/accounts');
const a = privateKeyToAccount('0x<your-private-key>');
console.log(a.address);
"
```

3/ Register your agent (NOTE: This is the same with the step 3 of the "Quick start" above)

Register your agent's `wallet-address` (agent's `public-key`)
```bash
bunx @worldcoin/agentkit-cli register <agent's wallet-address>
```
