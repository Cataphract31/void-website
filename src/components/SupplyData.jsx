import React from 'react';
import styled, { keyframes } from 'styled-components';

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const SupplyWrapper = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
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

const SupplyGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
`;

const SupplyCard = styled.div`
  background: rgba(155, 48, 255, 0.04);
  border: 1px solid rgba(155, 48, 255, 0.08);
  border-radius: 16px;
  padding: 1.5rem 1rem;
  text-align: center;
  backdrop-filter: blur(12px);
  transition: all 0.4s ease;
  position: relative;
  overflow: hidden;

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
  }

  &:hover {
    border-color: rgba(155, 48, 255, 0.2);
    background: rgba(155, 48, 255, 0.06);
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(155, 48, 255, 0.08);
  }
`;

const SupplyLabel = styled.p`
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 0.6rem;
  font-family: 'Space Grotesk', sans-serif;
`;

const SupplyValue = styled.p`
  font-size: 1.4rem;
  font-weight: 600;
  font-family: 'Space Grotesk', sans-serif;
  margin: 0;
  color: ${props => props.color || '#d68fff'};
`;

const BurnBar = styled.div`
  margin-top: 1.5rem;
  background: rgba(155, 48, 255, 0.06);
  border-radius: 20px;
  height: 6px;
  overflow: hidden;
  position: relative;
`;

const BurnProgress = styled.div`
  height: 100%;
  border-radius: 20px;
  background: linear-gradient(90deg, #7B2FBE, #9B30FF, #b44aff);
  width: ${props => props.percent || 0}%;
  transition: width 1s ease;
  box-shadow: 0 0 10px rgba(155, 48, 255, 0.3);
`;

const BurnLabel = styled.p`
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.2);
  margin-top: 0.5rem;
  letter-spacing: 0.1em;
  font-family: 'Space Grotesk', sans-serif;
`;

const SupplyData = ({ data }) => {
  const formatNumber = (number) => {
    if (number === undefined || number === null) return '...';
    if (typeof number !== 'number') return '—';
    return number.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  if (!data) {
    return (
      <SupplyWrapper>
        <SupplyLabel>Loading supply data...</SupplyLabel>
      </SupplyWrapper>
    );
  }

  const burnedPct = ((data.burnedSupply / data.totalSupply) * 100).toFixed(2);

  return (
    <SupplyWrapper>
      <SectionHeader>
        <HeaderLine />
        <HeaderText>Supply Status</HeaderText>
        <HeaderLine />
      </SectionHeader>

      <SupplyGrid>
        <SupplyCard>
          <SupplyLabel>Circulating</SupplyLabel>
          <SupplyValue>{formatNumber(data.circulatingSupply)}</SupplyValue>
        </SupplyCard>
        <SupplyCard>
          <SupplyLabel>Burned</SupplyLabel>
          <SupplyValue color="#ff6b6b">{formatNumber(data.burnedSupply)}</SupplyValue>
        </SupplyCard>
        <SupplyCard>
          <SupplyLabel>Burned %</SupplyLabel>
          <SupplyValue color="#ff6b6b">{burnedPct}%</SupplyValue>
        </SupplyCard>
        <SupplyCard>
          <SupplyLabel>Total Supply</SupplyLabel>
          <SupplyValue color="rgba(255,255,255,0.35)">100,000,000</SupplyValue>
        </SupplyCard>
      </SupplyGrid>

      <BurnBar>
        <BurnProgress percent={parseFloat(burnedPct)} />
      </BurnBar>
      <BurnLabel>SUPPLY CONSUMED BY THE VOID</BurnLabel>
    </SupplyWrapper>
  );
};

export default SupplyData;