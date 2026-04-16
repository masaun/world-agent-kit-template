/**
 * World AgentKit — Demo Server
 *
 * Implements the integrate-guide workflow:
 *   1. Protected /data endpoint with AgentKit extension declared
 *   2. createAgentkitHooks wires free-trial verification (3 uses) via AgentBook
 *   3. Verified agents get free access; unregistered agents receive a 402
 *
 * Run:
 *   npm run dev:server
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import {
  AGENTKIT,
  InMemoryAgentKitStorage,
  createAgentBookVerifier,
  createAgentkitHooks,
  declareAgentkitExtension,
} from "@worldcoin/agentkit";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "localhost";
const BASE_URL = process.env.BASE_URL ?? `http://${HOST}:${PORT}`;
const PAY_TO = (process.env.PAY_TO ?? "0xYourPaymentAddressHere") as `0x${string}`;
const FREE_TRIAL_USES = Number(process.env.FREE_TRIAL_USES ?? 3);

// World Chain CAIP-2 identifier
const WORLD_CHAIN = process.env.WORLD_CHAIN_MAINNET ?? "eip155:480";
// World USDC on World Chain
const WORLD_USDC = process.env.USDC_ON_WORLD_CHAIN_MAINNET ?? "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1";

// ---------------------------------------------------------------------------
// AgentKit setup
// ---------------------------------------------------------------------------
const agentBook = createAgentBookVerifier();
const storage = new InMemoryAgentKitStorage();

const hooks = createAgentkitHooks({
  agentBook,
  storage,
  mode: { type: "free-trial", uses: FREE_TRIAL_USES },
  onEvent(event) {
    console.log("[AgentKit] event:", JSON.stringify(event));
  },
});

// Extension metadata that clients discover on 402 responses
const agentkitExtension = declareAgentkitExtension({
  domain: HOST,
  resourceUri: `${BASE_URL}/data`,
  network: WORLD_CHAIN,
  statement: "Verify your agent is backed by a real human",
  mode: { type: "free-trial", uses: FREE_TRIAL_USES },
});

// ---------------------------------------------------------------------------
// Payment requirement descriptor (x402 style)
// ---------------------------------------------------------------------------
const paymentRequirement = {
  scheme: "exact",
  price: "$0.01",
  currency: "USDC",
  network: WORLD_CHAIN,
  tokenAddress: WORLD_USDC,
  payTo: PAY_TO,
};

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------
const app = new Hono();
app.use(logger());

/**
 * AgentKit middleware — runs BEFORE x402 enforcement on protected routes.
 *
 * Intercepts requests that carry an X-AgentKit header, verifies the
 * registered-human proof via AgentBook, and either:
 *   • sets a context flag to bypass the 402 gate (free trial), or
 *   • lets the request fall through to the 402 response (trial exhausted /
 *     unregistered agent).
 */
app.use("/data", async (c, next) => {
  const agentkitHeader = c.req.header(AGENTKIT);

  if (agentkitHeader) {
    // Build the adapter shape expected by requestHook
    const context = {
      adapter: {
        getHeader: (name: string) => c.req.header(name),
        getUrl: () => c.req.url,
      },
      path: "/data",
    };

    try {
      // requestHook returns a verdict object (or undefined to fall through)
      const verdict = await hooks.requestHook(context);

      if (verdict && (verdict as Record<string, unknown>).grantAccess === true) {
        // Agent is a verified human within their free-trial quota — skip 402
        c.set("agentVerified" as never, true);
      }
    } catch (err) {
      console.error("[AgentKit] requestHook error:", err);
    }
  }

  await next();
});

// ---------------------------------------------------------------------------
// Protected endpoint: GET /data
// ---------------------------------------------------------------------------
app.get("/data", (c) => {
  const verified = c.get("agentVerified" as never);

  if (!verified) {
    // 402 Payment Required — includes x402 payment details and AgentKit
    // extension so the agent knows it can register to get free-trial access.
    return c.json(
      {
        error: "Payment Required",
        message:
          "Register your agent with World AgentKit for free-trial access, or include a valid x402 payment.",
        x402: {
          version: 1,
          accepts: [paymentRequirement],
          error: "X-Payment header missing or invalid",
        },
        agentkit: {
          extension: agentkitExtension,
          hint: "Register your wallet: npx @worldcoin/agentkit-cli register <your-address>",
        },
      },
      402
    );
  }

  // Serve the protected resource
  return c.json({
    success: true,
    message: "Hello, verified human-backed agent!",
    data: {
      timestamp: new Date().toISOString(),
      network: WORLD_CHAIN,
      freeTrialUsesAllowed: FREE_TRIAL_USES,
    },
  });
});

// ---------------------------------------------------------------------------
// Health / info endpoints
// ---------------------------------------------------------------------------
app.get("/", (c) =>
  c.json({
    name: "World AgentKit Demo Server",
    version: "0.1.0",
    endpoints: {
      "GET /data": "Protected resource — AgentKit free-trial or x402 payment required",
      "GET /health": "Health check",
    },
    agentkit: {
      mode: `free-trial (${FREE_TRIAL_USES} uses)`,
      network: WORLD_CHAIN,
      extension: agentkitExtension,
    },
  })
);

app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`\n World AgentKit Demo Server`);
  console.log(` Listening on http://${info.address}:${info.port}`);
  console.log(` Protected endpoint: GET ${BASE_URL}/data`);
  console.log(` Free-trial uses: ${FREE_TRIAL_USES} per registered human\n`);
});
