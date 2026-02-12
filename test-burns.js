import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=417e2987-91bc-4bdd-a6cd-c06b06976c5c";
const connection = new Connection(RPC_URL, "confirmed");

const VOID_MINT = "nkr7dkAuSPG2w8jksVeHTZmHRY8CMr6r1ekBG9eaPHb";
const INCINERATOR = "1nc1nerator11111111111111111111111111111111";
const DEAD_ADDRESS = "11111111111111111111111111111111";

async function testFetch() {
    console.log("Fetching supply...");
    const mint = new PublicKey(VOID_MINT);
    const supply = await connection.getTokenSupply(mint);
    console.log("Current Supply:", supply.value.uiAmount);

    console.log("Fetching signatures for mint...");
    const sigs = await connection.getSignaturesForAddress(mint, { limit: 20 });
    console.log(`Found ${sigs.length} signatures.`);

    for (const s of sigs) {
        console.log(`- ${s.signature} (Err: ${!!s.err})`);
        const tx = await connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) continue;

        const isBurn = tx.meta.logMessages?.some(l => l.includes("Burn") || l.includes("BurnChecked"));
        const post = tx.meta.postTokenBalances || [];
        const isDead = post.some(b => (b.owner === INCINERATOR || b.owner === DEAD_ADDRESS) && b.mint === VOID_MINT);

        if (isBurn || isDead) {
            console.log("  >>> FOUND BURN/DEAD TRANSFER");
        }
    }
}

testFetch();
