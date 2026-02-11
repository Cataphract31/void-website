import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import Intro from '../components/Intro';
import HowItWorks from '../components/HowItWorks';
import LiquidityPools from '../components/LiquidityPools';
import SupplyData from '../components/SupplyData';
import ContractInfo from '../components/ContractInfo';

const HomeWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 2rem 4rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Section = styled(motion.section)`
  width: 100%;
  margin-bottom: 2rem;
`;

const Divider = styled.div`
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(155, 48, 255, 0.2), transparent);
  margin: 2rem auto;
`;

// Placeholder: replace with actual VOID mint address after token creation
const VOID_MINT = 'VOID_MINT_ADDRESS_HERE';
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

const Home = () => {
  const [supplyData, setSupplyData] = useState(null);

  useEffect(() => {
    fetchSupplyData();
    const interval = setInterval(fetchSupplyData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSupplyData = async () => {
    try {
      const response = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenSupply',
          params: [VOID_MINT]
        })
      });
      const data = await response.json();

      if (data.result?.value) {
        const currentSupply = Number(data.result.value.uiAmount);
        const totalSupply = 100000000;
        setSupplyData({
          circulatingSupply: currentSupply,
          burnedSupply: totalSupply - currentSupply,
          totalSupply
        });
      }
    } catch (error) {
      console.error('Error fetching supply data:', error);
    }
  };

  return (
    <HomeWrapper>
      <Section>
        <Intro />
      </Section>

      <Divider />

      <Section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
      >
        <HowItWorks />
      </Section>

      <Divider />

      <Section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.6 }}
      >
        <LiquidityPools />
      </Section>

      {supplyData && (
        <>
          <Divider />
          <Section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
          >
            <SupplyData data={supplyData} />
          </Section>
        </>
      )}

      <Divider />

      <Section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <ContractInfo />
      </Section>
    </HomeWrapper>
  );
};

export default Home;