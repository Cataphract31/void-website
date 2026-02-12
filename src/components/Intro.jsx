import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const pulseGlow = keyframes`
  0%, 100% { text-shadow: 0 0 40px rgba(155, 48, 255, 0.2), 0 0 80px rgba(155, 48, 255, 0.05); }
  50% { text-shadow: 0 0 60px rgba(155, 48, 255, 0.35), 0 0 120px rgba(155, 48, 255, 0.1); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
`;

const IntroWrapper = styled.div`
  text-align: center;
  margin-bottom: 0.5rem;
  font-family: 'Space Grotesk', sans-serif;
  padding-top: 4rem;
`;

const LogoText = styled(motion.h1)`
  font-size: 5rem;
  font-weight: 700;
  letter-spacing: 0.35em;
  background: linear-gradient(
    135deg,
    #ffffff 0%,
    #d68fff 25%,
    #9B30FF 50%,
    #d68fff 75%,
    #ffffff 100%
  );
  background-size: 200% 200%;
  animation: ${gradientShift} 6s ease infinite, ${pulseGlow} 4s ease-in-out infinite;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.3rem;
  user-select: none;

  @media (max-width: 768px) {
    font-size: 3rem;
  }
`;

const Tagline = styled(motion.p)`
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.35em;
  text-transform: uppercase;
  margin-bottom: 2rem;
`;

const Description = styled(motion.p)`
  font-size: 1.15rem;
  margin-bottom: 2.5rem;
  color: rgba(255, 255, 255, 0.55);
  max-width: 550px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.8;
`;

const ButtonGroup = styled(motion.div)`
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
`;

const ripple = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(155, 48, 255, 0.3); }
  100% { box-shadow: 0 0 0 15px rgba(155, 48, 255, 0); }
`;

const TradeButton = styled(motion.a)`
  display: inline-block;
  background: linear-gradient(135deg, #7B2FBE, #9B30FF, #b44aff);
  background-size: 200% 200%;
  animation: ${gradientShift} 4s ease infinite;
  color: #ffffff;
  padding: 14px 36px;
  font-size: 1.1rem;
  font-weight: 600;
  font-family: 'Space Grotesk', sans-serif;
  text-decoration: none;
  border-radius: 50px;
  cursor: pointer;
  border: none;
  letter-spacing: 0.1em;
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    transform: translateY(-3px);
    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(-1px);
  }
`;

const SecondaryButton = styled(TradeButton)`
  background: transparent;
  animation: none;
  border: 1px solid rgba(155, 48, 255, 0.3);
  color: rgba(255, 255, 255, 0.7);

  &:hover {
    border-color: rgba(155, 48, 255, 0.6);
    background: rgba(155, 48, 255, 0.08);
    color: #d68fff;
  }
`;

const StatsRow = styled(motion.div)`
  display: flex;
  justify-content: center;
  gap: 3rem;
  margin-top: 4rem;
  flex-wrap: wrap;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 1.8rem;
  font-weight: 700;
  color: #d68fff;
  margin-bottom: 0.3rem;
`;

const StatLabel = styled.div`
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.25);
  text-transform: uppercase;
  letter-spacing: 0.15em;
`;

const ScrollIndicator = styled(motion.div)`
  margin-top: 3rem;
  color: rgba(155, 48, 255, 0.3);
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  animation: ${float} 3s ease-in-out infinite;
  cursor: default;
`;

const AnimatedCounter = ({ target, suffix = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return <>{count.toLocaleString()}{suffix}</>;
};

const Intro = () => {
  return (
    <IntroWrapper>
      <LogoText
        initial={{ opacity: 0, y: -30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        VOID
      </LogoText>
      <Tagline
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        The Black Hole of Solana
      </Tagline>
      <Description
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.7 }}
      >
        A deflationary protocol that consumes its own liquidity, burns its supply,
        and fuels an ever-growing ecosystem of pools. Zero taxes. Unstoppable.
      </Description>
      <ButtonGroup
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
      >
        <TradeButton
          href="https://jup.ag/swap/SOL-VOID"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          TRADE $VOID
        </TradeButton>
        <SecondaryButton
          href="/whitepaper"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          READ WHITEPAPER
        </SecondaryButton>
      </ButtonGroup>

      <StatsRow
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.3 }}
      >
        <StatItem>
          <StatValue><AnimatedCounter target={100} suffix="M" /></StatValue>
          <StatLabel>Initial Supply</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue>0%</StatValue>
          <StatLabel>Tax</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue>1%</StatValue>
          <StatLabel>LP Burned Per Cycle</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue>∞</StatValue>
          <StatLabel>Cycles</StatLabel>
        </StatItem>
      </StatsRow>

      <ScrollIndicator
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        ↓ scroll to explore ↓
      </ScrollIndicator>
    </IntroWrapper>
  );
};

export default Intro;