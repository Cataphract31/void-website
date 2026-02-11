import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const WhitepaperWrapper = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.85);
  font-family: 'Space Grotesk', sans-serif;
`;

const Title = styled(motion.h1)`
  color: #ffffff;
  margin-bottom: 0.5rem;
  text-align: center;
  text-shadow: 0 0 30px rgba(155, 48, 255, 0.2);
`;

const Subtitle = styled.p`
  text-align: center;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.9rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 3rem;
`;

const Link = styled.a`
  color: #b44aff;
  text-decoration: none;
  transition: color 0.3s ease;
  &:hover {
    color: #d68fff;
    text-shadow: 0 0 8px rgba(155, 48, 255, 0.3);
  }
`;

const Section = styled(motion.section)`
  margin-bottom: 2.5rem;
`;

const SectionTitle = styled.h2`
  color: #b44aff;
  margin-bottom: 1rem;
  font-weight: 600;
`;

const SubSectionTitle = styled.h3`
  color: #9B30FF;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

const Paragraph = styled.p`
  margin-bottom: 1rem;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.75);
`;

const List = styled.ul`
  margin-left: 1.5rem;
  margin-bottom: 1rem;
`;

const ListItem = styled.li`
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;

  &::marker {
    color: rgba(155, 48, 255, 0.5);
  }
`;

const HighlightBox = styled.div`
  background: rgba(155, 48, 255, 0.06);
  border: 1px solid rgba(155, 48, 255, 0.12);
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1.5rem 0;
`;

const IntervalTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.95rem;

  th, td {
    padding: 0.6rem 1rem;
    text-align: left;
    border-bottom: 1px solid rgba(155, 48, 255, 0.1);
  }

  th {
    color: #b44aff;
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  td {
    color: rgba(255, 255, 255, 0.65);
  }
`;

const Whitepaper = () => {
  return (
    <WhitepaperWrapper>
      <Title
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        VOID Whitepaper
      </Title>
      <Subtitle>The Black Hole of Solana</Subtitle>

      <Section>
        <SectionTitle>OVERVIEW</SectionTitle>
        <Paragraph>
          VOID is a deflationary protocol on Solana designed to consume its own liquidity,
          permanently burn its supply, and redirect the freed SOL into an expanding ecosystem
          of liquidity pools. Like a black hole at the center of a galaxy, VOID pulls
          everything inward — volume, arbitrage, fees — growing denser and more valuable as
          its supply shrinks.
        </Paragraph>
        <Paragraph>
          VOID has no taxes, no reflections, no hidden inflation. The burn mechanism operates
          independently of volume or price — it removes 1% of the LP position's liquidity on
          a fixed timer, destroying VOID tokens permanently while retaining the SOL for
          ecosystem growth.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>THE BURN MECHANISM</SectionTitle>
        <Paragraph>
          At the core of VOID is the autonomous burn engine — a TypeScript service that runs 24/7,
          interacting directly with the Raydium CLMM (Concentrated Liquidity Market Maker) pool on Solana.
        </Paragraph>

        <SubSectionTitle>How It Works</SubSectionTitle>
        <List>
          <ListItem>
            The engine checks if the burn timer has elapsed (initially every 12 hours).
          </ListItem>
          <ListItem>
            When triggered, it removes <strong>1% of the total LP liquidity</strong> from the VOID/SOL
            Raydium CLMM position.
          </ListItem>
          <ListItem>
            The VOID tokens received are <strong>permanently burned</strong> using the SPL Token burn instruction —
            they are destroyed, not sent to a dead wallet.
          </ListItem>
          <ListItem>
            The SOL received stays in the protocol wallet to be reinvested into side pools,
            creating new VOID/XXX liquidity pairs with partner tokens.
          </ListItem>
          <ListItem>
            Additionally, all VOID trading fees accrued in the pool are also burned at each cycle.
          </ListItem>
        </List>

        <HighlightBox>
          <SubSectionTitle>Dynamic Burn Intervals</SubSectionTitle>
          <Paragraph>
            As more supply is burned, the interval between burns increases, ensuring
            long-term sustainability:
          </Paragraph>
          <IntervalTable>
            <thead>
              <tr><th>Supply Burned</th><th>Interval</th></tr>
            </thead>
            <tbody>
              <tr><td>0 – 4%</td><td>12 hours</td></tr>
              <tr><td>5 – 9%</td><td>18 hours</td></tr>
              <tr><td>10 – 14%</td><td>24 hours</td></tr>
              <tr><td>15 – 29%</td><td>30 hours</td></tr>
              <tr><td>30 – 49%</td><td>36 hours</td></tr>
              <tr><td>50%+</td><td>48 hours</td></tr>
            </tbody>
          </IntervalTable>
        </HighlightBox>
      </Section>

      <Section>
        <SectionTitle>LIQUIDITY STRUCTURE</SectionTitle>

        <SubSectionTitle>VOID/SOL Pool (Main Pool)</SubSectionTitle>
        <Paragraph>
          The main VOID/SOL pool is deployed on Raydium CLMM — Solana's leading
          concentrated liquidity DEX, modeled after Uniswap V3. Raydium CLMM uses tick-based
          price ranges that allow precise liquidity placement and a high fixed fee tier (1%),
          maximizing revenue for the protocol.
        </Paragraph>
        <Paragraph>
          At launch, <strong>100% of the VOID supply</strong> is deposited single-sided into
          the pool across a concentrated price range. No initial SOL is required — the first
          buyer provides the SOL at the floor price, and the price moves up from there.
        </Paragraph>
        <Paragraph>
          Because VOID tokens are constantly removed (burned) from the pool while the SOL
          counterpart is retained and reinvested, the buy-side liquidity becomes increasingly
          dominant. VOID is effectively <strong>over-collateralized</strong> by SOL.
        </Paragraph>

        <SubSectionTitle>Side Pools (Ecosystem Growth)</SubSectionTitle>
        <Paragraph>
          The SOL captured from each burn is used to create new liquidity pools pairing VOID
          with other Solana tokens. These side pools generate constant arbitrage volume, which
          feeds fees back into the protocol and creates additional demand for VOID.
        </Paragraph>
        <Paragraph>
          Each new pool strengthens the flywheel: more pools → more arbitrage volume → more
          fees → more pools. This is the black hole effect — VOID pulls more of the Solana
          ecosystem into its gravitational field with every cycle.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>TOKENOMICS</SectionTitle>
        <Paragraph>
          VOID launched with a maximum supply of <strong>100,000,000 tokens</strong> using the
          standard SPL Token program on Solana. At creation:
        </Paragraph>
        <List>
          <ListItem>
            <strong>Mint authority revoked</strong> — no tokens can ever be created beyond the initial supply
          </ListItem>
          <ListItem>
            <strong>Freeze authority revoked</strong> — nobody can freeze or seize tokens
          </ListItem>
          <ListItem>
            <strong>Metadata immutable</strong> — token info cannot be changed
          </ListItem>
          <ListItem>
            <strong>Zero tax</strong> — no transfer fees, no buy/sell tax, no hidden mechanics
          </ListItem>
          <ListItem>
            <strong>100% into LP</strong> — entire supply deposited into Raydium CLMM at launch, single-sided
          </ListItem>
        </List>
      </Section>

      <Section>
        <SectionTitle>TRUST & INCENTIVE ALIGNMENT</SectionTitle>
        <Paragraph>
          VOID is a <strong>stealth, fair launch</strong> — no presale, no team allocation,
          no insider tokens. The entire 100M supply goes directly into the liquidity pool
          at launch. The developer holds zero VOID tokens.
        </Paragraph>
        <HighlightBox>
          <SubSectionTitle>Developer Incentives</SubSectionTitle>
          <List>
            <ListItem>
              <strong>Zero token allocation</strong> — the developer does not hold, receive, or reserve
              any VOID tokens at launch or at any point
            </ListItem>
            <ListItem>
              <strong>Income from LP fees only</strong> — the developer earns exclusively from trading
              fees generated by the protocol's liquidity position, the same pool that benefits all holders
            </ListItem>
            <ListItem>
              <strong>Rug-proof by design</strong> — with no token holdings, there is nothing to dump.
              The only way the developer profits is by growing the protocol: more volume → more fees → more income
            </ListItem>
            <ListItem>
              <strong>Aligned incentives</strong> — developer income scales with protocol success, creating
              a direct economic incentive to maintain, improve, and expand the ecosystem
            </ListItem>
          </List>
        </HighlightBox>
        <Paragraph>
          This structure eliminates the most common rug-pull vector in crypto — team token dumps.
          The developer's financial interest is permanently and irrevocably tied to the long-term
          health and growth of the VOID protocol.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>WHY RAYDIUM CLMM?</SectionTitle>
        <Paragraph>
          Raydium's Concentrated Liquidity Market Maker was chosen as the primary DEX
          for the VOID/SOL pool:
        </Paragraph>
        <List>
          <ListItem>
            <strong>High fee tiers</strong> — 1% base fee per swap maximizes protocol revenue, critical for funding the burn + ecosystem expansion flywheel
          </ListItem>
          <ListItem>
            <strong>Concentrated liquidity</strong> — tick-based price ranges (Uniswap V3 model) for precise, capital-efficient liquidity placement
          </ListItem>
          <ListItem>
            <strong>Separate fee collection</strong> — trading fees accrue separately from LP, claimable anytime without removing liquidity
          </ListItem>
          <ListItem>
            <strong>Jupiter integration</strong> — Raydium pools are automatically routed through Jupiter, Solana's leading aggregator, ensuring maximum volume
          </ListItem>
          <ListItem>
            <strong>Composability</strong> — well-supported TypeScript SDK for automated bot interaction
          </ListItem>
        </List>
        <Paragraph>
          Side pools pairing VOID with partner tokens are deployed on Meteora DLMM, using
          concentrated bin ranges for capital-efficient arbitrage routing.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>THE FLYWHEEL</SectionTitle>
        <Paragraph>
          VOID's deflationary mechanism creates a self-reinforcing cycle:
        </Paragraph>
        <HighlightBox>
          <List>
            <ListItem>
              <strong>Burn</strong> → 1% LP removed, VOID burned, SOL retained
            </ListItem>
            <ListItem>
              <strong>Reinvest</strong> → SOL used to create VOID/XXX side pools
            </ListItem>
            <ListItem>
              <strong>Arbitrage</strong> → price differences between pools create volume
            </ListItem>
            <ListItem>
              <strong>Fees</strong> → trading volume generates fees, VOID fees burned
            </ListItem>
            <ListItem>
              <strong>Grow</strong> → SOL fees + burn SOL fund new pools
            </ListItem>
            <ListItem>
              <strong>Repeat</strong> → more pools = more volume = more fees = faster expansion
            </ListItem>
          </List>
        </HighlightBox>
        <Paragraph>
          With increasing returns to scale — each new pool adds volume, liquidity, and fee
          revenue — VOID's gravitational pull grows stronger with time.
        </Paragraph>
      </Section>



      <Section>
        <SectionTitle>FUTURE DEVELOPMENTS</SectionTitle>
        <List>
          <ListItem>
            <strong>Decentralization</strong> — upgrade to an on-chain Anchor program with PDA-owned
            LP position, making the burn mechanism fully trustless, decentralized and permissionless
          </ListItem>
          <ListItem>
            <strong>Governance</strong> — VOID holders vote on which tokens to pair with for new pools
          </ListItem>
          <ListItem>
            <strong>Cross-chain expansion</strong> — VOID pools on multiple Solana DEXs and
            potential expansion to other chains or even assets/commodities.
          </ListItem>
          <ListItem>
            <strong>Dashboard</strong> — real-time burn tracking, supply metrics, and pool analytics
          </ListItem>
        </List>
      </Section>

      <Section>
        <SectionTitle>DISCLAIMER</SectionTitle>
        <Paragraph style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)' }}>
          This document is not a prospectus and does not constitute nor imply a prospectus of
          any sort. No wording contained herein should be construed as a solicitation for
          investment. This whitepaper does not pertain in any way to an offering of securities
          in any jurisdiction worldwide. Always conduct your own research and invest responsibly.
        </Paragraph>
      </Section>
    </WhitepaperWrapper>
  );
};

export default Whitepaper;