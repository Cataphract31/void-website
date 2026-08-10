/**
 * /api/stats — live protocol numbers for the site, read straight from Solana.
 *
 * The browser never talks to an RPC and never sees a key. This function runs
 * on Vercel, does two RPC calls, and the CDN caches the answer: however many
 * people are on the site, the RPC provider sees at most a couple of requests
 * per minute (see Cache-Control below).
 *
 * Configuration is entirely via Vercel env vars, so going live at genesis is
 * a dashboard action, not a deploy:
 *
 *   VOID_MINT   mint address        (unset => {live:false}, site shows pre-launch)
 *   STATE_PDA   EntropyState account
 *   POOL        pool address        (optional, used for links)
 *   RPC_URL     RPC endpoint        (SECRET — set the keyed endpoint here;
 *                                    defaults to the public mainnet RPC)
 *
 * EntropyState layout (Anchor: 8-byte discriminator, then declaration order):
 *   7 x Pubkey (admin, treasury_authority, ops_destination, void_mint, pool,
 *               position, position_nft_account)        bytes   8..232
 *   u64 initial_supply                                 bytes 232..240
 *   i64 last_claim_ts                                  bytes 240..248
 *   u64 total_claims                                   bytes 248..256
 *   u64 total_void_burned                              bytes 256..264
 */

const DECIMALS = 6;

/** Mirror of on-chain interval_secs (lib.rs). Base 6h, +6h at 5/10/15% burned. */
function intervalSecs(burnedBps) {
  const H6 = 21_600;
  let interval = H6;
  if (burnedBps >= 500) interval += H6;
  if (burnedBps >= 1_000) interval += H6;
  if (burnedBps >= 1_500) interval += H6;
  return interval;
}

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC: ${json.error.message}`);
  return json.result;
}

module.exports = async (req, res) => {
  // The CDN, not this function, absorbs the traffic. s-maxage: one cached
  // answer serves everyone for 30s; stale-while-revalidate: visitors during a
  // refresh get the previous answer instantly instead of waiting on the RPC.
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const mint = process.env.VOID_MINT;
  const statePda = process.env.STATE_PDA;
  if (!mint || !statePda) {
    // Pre-launch: nothing configured yet. Cache longer, nothing changes fast.
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ live: false });
  }

  const url = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

  try {
    const [supplyRes, stateRes] = await Promise.all([
      rpc(url, "getTokenSupply", [mint]),
      rpc(url, "getAccountInfo", [statePda, { encoding: "base64" }]),
    ]);

    if (!stateRes?.value?.data?.[0]) throw new Error("state account not found");
    const data = Buffer.from(stateRes.value.data[0], "base64");
    if (data.length < 264) throw new Error(`state account too small: ${data.length}`);

    const initialSupplyRaw = data.readBigUInt64LE(232);
    const lastClaimTs = Number(data.readBigInt64LE(240));
    const totalClaims = Number(data.readBigUInt64LE(248));

    const supplyRaw = BigInt(supplyRes.value.amount);
    const burnedRaw = initialSupplyRaw - supplyRaw;
    const burnedBps = Number((burnedRaw * 10_000n) / initialSupplyRaw);

    return res.status(200).json({
      live: true,
      supply: Number(supplyRaw) / 10 ** DECIMALS,
      burned: Number(burnedRaw) / 10 ** DECIMALS,
      totalClaims,
      lastClaimTs,
      intervalSecs: intervalSecs(burnedBps),
      mint,
      pool: process.env.POOL || undefined,
      updatedAt: Math.floor(Date.now() / 1000),
    });
  } catch (e) {
    // Never break the page over a flaky RPC: a short-cached soft failure lets
    // the site fall back to its last good values / pre-launch defaults.
    res.setHeader("Cache-Control", "public, s-maxage=15");
    return res.status(200).json({ live: false, error: String(e.message || e).slice(0, 200) });
  }
};
