import React from 'react';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`;

const Wrapper = styled.div`
  text-align: center;
  margin: 4rem 0;
  font-family: 'Space Grotesk', sans-serif;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 3rem;
`;

const HeaderText = styled.h2`
  font-size: 1.3rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 1.5rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const HeaderLine = styled.div`
  flex-grow: 1;
  max-width: 100px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(155, 48, 255, 0.25), transparent);
`;

const FlywheelContainer = styled.div`
  position: relative;
  width: 320px;
  height: 320px;
  margin: 0 auto 4.5rem;
`;

const OrbitRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 280px;
  height: 280px;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(155, 48, 255, 0.1);
  border-radius: 50%;
  animation: ${rotate} 30s linear infinite;
`;

const InnerRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 180px;
  height: 180px;
  transform: translate(-50%, -50%);
  border: 1px dashed rgba(155, 48, 255, 0.08);
  border-radius: 50%;
  animation: ${rotate} 20s linear infinite reverse;
`;

const CenterNode = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(155, 48, 255, 0.3), rgba(0, 0, 0, 0.9));
  border: 1px solid rgba(155, 48, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: #d68fff;
  letter-spacing: 0.1em;
  box-shadow: 0 0 40px rgba(155, 48, 255, 0.15), inset 0 0 20px rgba(155, 48, 255, 0.1);
`;

const StepNode = styled(motion.div)`
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(155, 48, 255, 0.06);
  border: 1px solid rgba(155, 48, 255, 0.15);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.55rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  line-height: 1.3;
  cursor: default;
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(155, 48, 255, 0.4);
    background: rgba(155, 48, 255, 0.12);
    color: #d68fff;
    box-shadow: 0 0 20px rgba(155, 48, 255, 0.15);
    transform: scale(1.1);
  }
`;

const StepsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  max-width: 700px;
  margin: 0 auto;
`;

const StepCard = styled(motion.div)`
  background: rgba(155, 48, 255, 0.04);
  border: 1px solid rgba(155, 48, 255, 0.08);
  border-radius: 16px;
  padding: 1.5rem;
  text-align: left;
  backdrop-filter: blur(8px);
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(155, 48, 255, 0.2);
    background: rgba(155, 48, 255, 0.06);
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(155, 48, 255, 0.08);
  }
`;

const StepIcon = styled.div`
  font-size: 1.5rem;
  margin-bottom: 0.8rem;
`;

const StepTitle = styled.h4`
  color: #b44aff;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const StepDesc = styled.p`
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.8rem;
  line-height: 1.6;
  margin: 0;
`;

const ArrowDown = styled.div`
  color: rgba(155, 48, 255, 0.2);
  font-size: 1.5rem;
  margin: 1rem 0;
  animation: ${pulse} 2s ease-in-out infinite;
`;

const steps = [
  { icon: '🔥', title: 'BURN', desc: 'Bot removes 1% LP liquidity. VOID tokens destroyed permanently.' },
  { icon: '💧', title: 'COLLECT', desc: 'SOL from the burn is retained by the protocol wallet.' },
  { icon: '🌊', title: 'REINVEST', desc: 'SOL used to create new VOID/TOKEN pools across Solana.' },
  { icon: '⚡', title: 'ARBITRAGE', desc: 'Price differences between pools generate automatic trading volume.' },
  { icon: '💰', title: 'FEES', desc: 'Volume generates fees. VOID fees burned. SOL fees reinvested.' },
  { icon: '♾️', title: 'REPEAT', desc: 'More pools → more volume → more fees → more pools. Infinite flywheel.' },
];

// Positions for circular layout
const nodePositions = [
  { top: '0%', left: '50%', transform: 'translate(-50%, -50%)' },
  { top: '25%', left: '93%', transform: 'translate(-50%, -50%)' },
  { top: '75%', left: '93%', transform: 'translate(-50%, -50%)' },
  { top: '100%', left: '50%', transform: 'translate(-50%, -50%)' },
  { top: '75%', left: '7%', transform: 'translate(-50%, -50%)' },
  { top: '25%', left: '7%', transform: 'translate(-50%, -50%)' },
];

const HowItWorks = () => {
  return (
    <Wrapper>
      <SectionHeader>
        <HeaderLine />
        <HeaderText>The Flywheel</HeaderText>
        <HeaderLine />
      </SectionHeader>

      <FlywheelContainer>
        <OrbitRing />
        <InnerRing />
        <CenterNode>VOID</CenterNode>
        {steps.map((step, i) => (
          <StepNode
            key={step.title}
            style={nodePositions[i]}
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            {step.icon}<br />{step.title}
          </StepNode>
        ))}
      </FlywheelContainer>

      <StepsGrid>
        {steps.map((step, i) => (
          <StepCard
            key={step.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            <StepIcon>{step.icon}</StepIcon>
            <StepTitle>{step.title}</StepTitle>
            <StepDesc>{step.desc}</StepDesc>
          </StepCard>
        ))}
      </StepsGrid>
    </Wrapper>
  );
};

export default HowItWorks;
