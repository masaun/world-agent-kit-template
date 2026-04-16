/**
 * World AgentKit — Demo Agent Client
 *
 * Demonstrates the full workflow from the integrate guide:
 *   1. Derives an Ethereum wallet from AGENT_PRIVATE_KEY
 *   2. Builds an AgentkitPayload (SIWE + signature) for each request
 *   3. Base64-encodes the payload and sends it in the "agentkit" header
 *   4. Retries automatically; shows how free-trial uses are consumed
 *
 * Prerequisites:
 *   1. npx @worldcoin/agentkit-cli register <agent-address>   (once)
 *   2. Set AGENT_PRIVATE_KEY in .env
 *
 * Run:
 *   npm run dev:agent
 */
import {
  AGENTKIT,
  type AgentkitPayload,
  formatSIWEMessage,
} from "@worldcoin/agentkit";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { worldchain } from "viem/chains";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";
const RESOURCE_URI = `${SERVER_URL}/data`;
const DOMAIN = new URL(SERVER_URL).hostname || "localhost";

// World Chain CAIP-2 identifier
const CHAIN_ID = "eip155:480";

// Agent private key — load from secrets manager in production
const rawKey = process.env.AGENT_PRIVATE_KEY;
if (!rawKey) {
  console.error(
    "ERROR: AGENT_PRIVATE_KEY is not set.\n" +
      "Add it to .env, then register your agent address:\n" +
      "  bunx @worldcoin/agentkit-cli register <agent-address>\n"
  );
  process.exit(1);
}

const privateKey = rawKey.startsWith("0x")
  ? (rawKey as `0x${string}`)
  : (`0x${rawKey}` as `0x${string}`);

const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({
  account,
  chain: worldchain,
  transport: http(),
});

// ---------------------------------------------------------------------------
// Build the AgentKit header value
//
// The header value is a base64-encoded JSON blob matching AgentkitPayload:
//   { domain, address, uri, version, chainId, type, nonce, issuedAt,
//     statement?, expirationTime?, signature }
// ---------------------------------------------------------------------------
async function buildAgentkitHeader(): Promise<string> {
  const nonce = generateNonce();
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  // formatSIWEMessage builds the EIP-4361 string that the server verifies.
  const info = {
    domain: DOMAIN,
    uri: RESOURCE_URI,
    statement: "Verify your agent is backed by a real human",
    version: "1",
    nonce,
    issuedAt,
    expirationTime,
  };
  const message = formatSIWEMessage(
    { ...info, chainId: CHAIN_ID, type: "eip191" as const },
    account.address
  );

  // Sign with eip191 (personal_sign)
  const signature = await walletClient.signMessage({ message });

  // Assemble the full payload
  const payload: AgentkitPayload = {
    domain: DOMAIN,
    address: account.address,
    statement: info.statement,
    uri: RESOURCE_URI,
    version: "1",
    chainId: CHAIN_ID,
    type: "eip191",
    nonce,
    issuedAt,
    expirationTime,
    signature,
  };

  // Encode as base64 JSON — matching parseAgentkitHeader expectations
  return btoa(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Make a single authenticated request to the protected endpoint
// ---------------------------------------------------------------------------
async function fetchProtectedResource(attempt: number): Promise<void> {
  console.log(`\n--- Request #${attempt} ---`);

  let headerValue: string;
  try {
    headerValue = await buildAgentkitHeader();
  } catch (err) {
    console.error("Failed to build AgentKit header:", err);
    return;
  }

  const response = await fetch(RESOURCE_URI, {
    method: "GET",
    headers: {
      [AGENTKIT]: headerValue,
      "Content-Type": "application/json",
    },
  });

  const body = (await response.json()) as Record<string, unknown>;

  if (response.status === 200) {
    console.log("SUCCESS — free-trial access granted");
    console.log("Response:", JSON.stringify(body, null, 2));
  } else if (response.status === 402) {
    console.log("402 PAYMENT REQUIRED — free-trial exhausted or agent not registered");
    const hint = (body?.agentkit as Record<string, unknown> | undefined)?.hint;
    if (hint) console.log("Hint:", hint);
    else console.log("Response:", JSON.stringify(body, null, 2));
  } else {
    console.log(`HTTP ${response.status}:`, JSON.stringify(body, null, 2));
  }
}

// ---------------------------------------------------------------------------
// Demo — sends DEMO_REQUESTS requests to show quota exhaustion
// ---------------------------------------------------------------------------
const TOTAL_REQUESTS = Number(process.env.DEMO_REQUESTS ?? 4);

console.log("World AgentKit — Agent Demo");
console.log("============================");
console.log(`Server       : ${SERVER_URL}`);
console.log(`Resource     : ${RESOURCE_URI}`);
console.log(`Agent wallet : ${account.address}`);
console.log(`Requests     : ${TOTAL_REQUESTS}  (expect 3 free, then 402)\n`);
console.log("NOTE: Your agent must be registered first:");
console.log(`  bunx @worldcoin/agentkit-cli register ${account.address}\n`);

for (let i = 1; i <= TOTAL_REQUESTS; i++) {
  await fetchProtectedResource(i);
  await new Promise((r) => setTimeout(r, 500));
}

console.log("\nDemo complete.");
console.log("Restart the server to reset the in-memory trial counter.");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
