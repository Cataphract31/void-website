import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Use the Helius RPC URL
const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=417e2987-91bc-4bdd-a6cd-c06b06976c5c";
const connection = new Connection(RPC_URL, 'confirmed');

const VOID_MINT = "nkr7dkAuSPG2w8jksVeHTZmHRY8CMr6r1ekBG9eaPHb";
const INCINERATOR = "1nc1nerator11111111111111111111111111111111";
const DEAD_ADDRESS = "11111111111111111111111111111111";
const BURN_BOT_WALLET = "CEJnLWLEzRGSaeaoWKVSnhA4QD4mZaRY9sQbz4NNfyLz";

// Historical significant burns that might fall out of every RPC scan window
const LEGACY_BURNS = [
    "3XxDWDE3vDcnSBfPWhZmif7RzdUxEwdwJNQPXqYdoAVhQP2gQuX2EsqujeQ71gsbpZpm1AXagTKi55LymnEDGN3k"
];

export const getVoidStats = async () => {
    try {
        const mint = new PublicKey(VOID_MINT);
        const supplyInfo = await connection.getTokenSupply(mint);

        const currentSupply = supplyInfo.value.uiAmount;
        const initialSupply = 100_000_000;
        const burnedAmount = initialSupply - currentSupply;

        return {
            currentSupply,
            burnedAmount,
            burnPercentage: (burnedAmount / initialSupply) * 100
        };
    } catch (error) {
        console.error("Error fetching stats:", error);
        return null;
    }
};

/**
 * Robust Burn History Tracker
 * Scans both the Mint (for recent community activity) and the Burn Bot Wallet (for archive accuracy).
 * Uses localStorage to prevent redundant RPC lookups.
 */
export const getBurnHistory = async (limit = 10) => {
    try {
        const CACHE_KEY = 'void_burn_history_v2';
        let cachedBurns = [];
        try {
            const stored = localStorage.getItem(CACHE_KEY);
            if (stored) cachedBurns = JSON.parse(stored);
        } catch (e) { /* ignore */ }

        const mint = new PublicKey(VOID_MINT);
        const botWallet = new PublicKey(BURN_BOT_WALLET);

        // Hybrid Scanning:
        // 1. Mint Signatures (Recent 100 - catches swaps/community noise)
        // 2. Bot Wallet Signatures (Recent 1000 - catches all official burns with almost zero noise)
        const [mintSigs, botSigs] = await Promise.all([
            connection.getSignaturesForAddress(mint, { limit: 100 }, 'confirmed'),
            connection.getSignaturesForAddress(botWallet, { limit: 1000 }, 'confirmed')
        ]);

        const allSigs = new Set([...mintSigs, ...botSigs].map(s => s.signature));
        LEGACY_BURNS.forEach(sig => allSigs.add(sig));

        const newBurns = [];
        const existingSigs = new Set(cachedBurns.map(b => b.signature));

        for (const sig of allSigs) {
            if (existingSigs.has(sig)) continue;

            try {
                const tx = await connection.getParsedTransaction(sig, {
                    maxSupportedTransactionVersion: 0,
                    commitment: 'confirmed'
                });

                if (!tx || !tx.meta) continue;

                const isBurnLog = tx.meta.logMessages?.some(log =>
                    log.includes("Instruction: Burn") || log.includes("BurnChecked")
                );
                const postBalances = tx.meta.postTokenBalances || [];
                const isDeadTransfer = postBalances.some(b =>
                    (b.owner === INCINERATOR || b.owner === DEAD_ADDRESS) && b.mint === VOID_MINT
                );

                if (isBurnLog || isDeadTransfer) {
                    const preBalances = tx.meta.preTokenBalances || [];
                    const preTotal = preBalances.reduce((acc, b) => b.mint === VOID_MINT ? acc + (b.uiTokenAmount.uiAmount || 0) : acc, 0);
                    const postTotal = postBalances.reduce((acc, b) => b.mint === VOID_MINT ? acc + (b.uiTokenAmount.uiAmount || 0) : acc, 0);
                    const burnAmount = preTotal - postTotal;

                    if (burnAmount > 0.0001) {
                        newBurns.push({
                            signature: sig,
                            blockTime: tx.blockTime,
                            amount: burnAmount,
                            burner: tx.transaction.message.accountKeys[0].pubkey.toBase58()
                        });
                    }
                }
            } catch (err) {
                // Transaction may be too old or inaccessible
            }
        }

        const merged = [...newBurns, ...cachedBurns]
            .sort((a, b) => b.blockTime - a.blockTime)
            .slice(0, 50);

        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
        } catch (e) { /* ignore */ }

        return merged.slice(0, limit);
    } catch (error) {
        console.error("Error fetching history:", error);
        return [];
    }
};

export const formatNumber = (num, decimals = 2) => {
    if (!num) return "0";
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
};

export const shortenAddress = (addr) => {
    if (!addr) return "...";
    return addr.slice(0, 4) + '...' + addr.slice(-4);
};
