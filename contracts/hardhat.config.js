import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';

const accountKey = process.env.HEDERA_OPERATOR_KEY;

export default {
  solidity: '0.8.24',
  networks: {
    hardhat: {},
    hederaTestnet: {
      url: 'https://testnet.hashio.io/api',
      chainId: 296,
      accounts: accountKey ? [accountKey] : []
    }
  }
};