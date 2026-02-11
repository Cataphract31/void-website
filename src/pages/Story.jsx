import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const StoryWrapper = styled.div`
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
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 3rem;
`;

const Section = styled(motion.section)`
  margin-bottom: 2.5rem;
`;

const SectionTitle = styled.h2`
  color: #b44aff;
  margin-bottom: 1rem;
  font-weight: 600;
`;

const Paragraph = styled.p`
  margin-bottom: 1rem;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.7);
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

const StepNumber = styled.span`
  color: #9B30FF;
  font-weight: 700;
  margin-right: 0.5rem;
`;

const Story = () => {
  return (
    <StoryWrapper>
      <Title
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        The VOID Story
      </Title>
      <Subtitle>How a black hole swallows a blockchain</Subtitle>

      <Section>
        <Paragraph>
          In every ecosystem, there's entropy. Tokens launch, liquidity fragments, value disperses.
          Projects rise and fall. Pools dry up. The natural state of any chain is disorder —
          scattered liquidity, isolated tokens, and diminishing returns.
        </Paragraph>
        <Paragraph>
          VOID was designed to reverse that entropy.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>THE MECHANISM</SectionTitle>
        <Paragraph>
          Every 12 to 48 hours — scaling with how much has been burned — the bot removes 1% of the
          VOID/SOL liquidity pool. The VOID tokens are permanently destroyed. The SOL is kept and
          reinvested into new pools, pairing VOID with other tokens across the Solana ecosystem.
        </Paragraph>
        <Paragraph>
          Each new pool creates arbitrage opportunities. Arbitrage creates volume. Volume creates
          fees. Fees fund more pools. More pools create more arbitrage. The flywheel spins, and
          VOID's gravitational pull grows.
        </Paragraph>
        <Paragraph>
          This is how a black hole forms. Not through a single catastrophic event, but through
          the slow, relentless accumulation of gravity — each cycle pulling a little more of the
          ecosystem into its orbit.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>WHY SOLANA</SectionTitle>
        <Paragraph>
          Solana's speed and cost structure are ideal for a protocol that needs to execute
          frequent, automated on-chain actions. Sub-second finality, negligible transaction
          fees, and a mature DEX ecosystem (Meteora, Jupiter, Raydium) mean the burn bot can
          operate efficiently without friction.
        </Paragraph>
        <Paragraph>
          Meteora's DLMM — with its dynamic fees, single-sided deposit support, and discrete
          price bins — is the perfect infrastructure for VOID's concentrated liquidity strategy.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>HOW TO PARTICIPATE</SectionTitle>
        <Paragraph>
          <StepNumber>1.</StepNumber>
          Set up a Solana wallet — <Link href="https://phantom.app" target="_blank" rel="noopener noreferrer">Phantom</Link> is
          the most popular option.
        </Paragraph>
        <Paragraph>
          <StepNumber>2.</StepNumber>
          Get SOL — buy on any exchange and transfer to your Phantom wallet, or bridge from
          another chain via <Link href="https://www.portalbridge.com" target="_blank" rel="noopener noreferrer">Portal Bridge</Link>.
        </Paragraph>
        <Paragraph>
          <StepNumber>3.</StepNumber>
          Trade VOID — swap SOL for VOID on <Link href="https://jup.ag/swap/SOL-VOID" target="_blank" rel="noopener noreferrer">Jupiter</Link> or
          your preferred Solana DEX aggregator.
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>THE FUTURE</SectionTitle>
        <Paragraph>
          VOID will expand across Solana's ecosystem, creating pools with the chain's strongest
          tokens. As the web of pools grows, so does the volume, the fees, and the gravitational
          pull.
        </Paragraph>
        <Paragraph>
          The ultimate goal: make all of Solana flow through VOID.
        </Paragraph>
      </Section>
    </StoryWrapper>
  );
};

export default Story;