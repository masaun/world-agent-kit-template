echo "1/ Generate an agent private key:"
AGENT_PRIVATE_KEY=$(bun -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))")

echo "Generated private key: $AGENT_PRIVATE_KEY"

echo ""

echo "2/ Derive an agent wallet address (public key) with a generated private key above using viem:"   
# NOTE: You need to set "0x<your-private-key>" to the privateKeyToAccount() below - before executing the following code.
AGENT_PUBLIC_KEY=$(bun -e "
    const { privateKeyToAccount } = require('viem/accounts');
    const a = privateKeyToAccount('$AGENT_PRIVATE_KEY');
    console.log(a.address);
")

echo "Generated public key (wallet address): $AGENT_PUBLIC_KEY"

echo "Register your agent's wallet-address (agent's public-key)"
bunx @worldcoin/agentkit-cli register $AGENT_PUBLIC_KEY

echo ""
