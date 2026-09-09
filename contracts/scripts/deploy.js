import { mkdir, writeFile } from 'node:fs/promises';
import hre from 'hardhat';

const [deployer] = await hre.ethers.getSigners();
const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
const feeBps = Number(process.env.DEFAULT_PROTOCOL_FEE_BPS || 100);

const protocolFactory = await hre.ethers.getContractFactory('SharedBondingCurve');
const protocol = await protocolFactory.deploy(feeRecipient, feeBps);
await protocol.waitForDeployment();

const marketFactory = await hre.ethers.getContractFactory('PulseMarketFactory');
const factory = await marketFactory.deploy(await protocol.getAddress());
await factory.waitForDeployment();

const factoryAuthorization = await protocol.setFactory(await factory.getAddress());
await factoryAuthorization.wait();

await mkdir('deployments', { recursive: true });
await writeFile(`deployments/${hre.network.name}.json`, JSON.stringify({
  network: hre.network.name,
  chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
  deployer: deployer.address,
  sharedBondingCurve: await protocol.getAddress(),
  marketFactory: await factory.getAddress()
}, null, 2));

console.log(JSON.stringify({ sharedBondingCurve: await protocol.getAddress(), marketFactory: await factory.getAddress() }));