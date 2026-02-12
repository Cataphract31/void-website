import React from 'react';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const PoolsWrapper = styled.div`
  text-align: center;
  margin: 2rem 0;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2rem;
`;

const HeaderText = styled.h2`
  font-family: 'Space Grotesk', sans-serif;
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

const PoolsGrid = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  justify-content: center;
`;

const PoolLink = styled(motion.a)`
  background: rgba(155, 48, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  padding: 1rem 0.8rem;
  border-radius: 12px;
  text-decoration: none;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 500;
  font-size: 0.9rem;
  border: 1px solid rgba(155, 48, 255, 0.08);
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(155, 48, 255, 0.3), transparent);
    background-size: 200% 100%;
    animation: ${shimmer} 3s ease-in-out infinite;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    background: rgba(155, 48, 255, 0.08);
    border-color: rgba(155, 48, 255, 0.2);
    color: #d68fff;
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(155, 48, 255, 0.08);

    &::before {
      opacity: 1;
    }
  }
`;

const PoolName = styled.div`
  font-weight: 600;
  margin-bottom: 0.3rem;
  color: rgba(255, 255, 255, 0.7);
`;

const PoolTag = styled.div`
  font-size: 0.6rem;
  color: rgba(155, 48, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

const LiquidityPools = () => {
  const pools = [
    { name: 'VOID / SOL', tag: 'Raydium CLMM', url: 'https://dexscreener.com/solana/nkr7dkAuSPG2w8jksVeHTZmHRY8CMr6r1ekBG9eaPHb', active: true },
    { name: 'VOID / WHITEWHALE', tag: 'Meteora DLMM', url: 'https://www.meteora.ag/dlmm/6rE8Ej3aae9QBukLYWFvzDAYmRgsygpKK1LbqLjHJGcL', active: true },
    { name: 'VOID / PENGUIN', tag: 'Meteora DLMM', url: 'https://www.meteora.ag/dlmm/5jW3M4defHZgCAt27FQU7upeELu5yWroiax9nmd2Bv62', active: true },
    { name: 'VOID / XXX', tag: 'Upcoming', url: '#', active: false },
  ];

  return (
    <PoolsWrapper>
      <SectionHeader>
        <HeaderLine />
        <HeaderText>Active Pools</HeaderText>
        <HeaderLine />
      </SectionHeader>
      <PoolsGrid>
        {pools.map((pool, index) => (
          <PoolLink
            key={pool.name}
            href={pool.active ? pool.url : undefined}
            target={pool.active ? "_blank" : undefined}
            rel={pool.active ? "noopener noreferrer" : undefined}
            as={pool.active ? motion.a : motion.div}
            style={!pool.active ? { opacity: 0.4, cursor: 'default' } : {}}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: pool.active ? 1 : 0.4, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={pool.active ? { scale: 1.02 } : {}}
          >
            <PoolName>{pool.name}</PoolName>
            <PoolTag>{pool.tag}</PoolTag>
          </PoolLink>
        ))}
      </PoolsGrid>
    </PoolsWrapper>
  );
};

export default LiquidityPools;