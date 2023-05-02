import { ethers, upgrades } from "hardhat";
import { AddressStorage, Storage } from "../util/storage";

async function main() {
	const network = await ethers.provider.getNetwork();
	const storage = new Storage("addresses.json");
	const addresses: AddressStorage = storage.fetch(network.chainId);
	const { astro: astroAddress } = addresses;
	const Astrobuddy = await ethers.getContractFactory("Astrobuddy");
	//await upgrades.forceImport(astroAddress, Astrobuddy)
	await upgrades.upgradeProxy(astroAddress, Astrobuddy);
	console.log("Astrobuddy upgraded");
}

main();
