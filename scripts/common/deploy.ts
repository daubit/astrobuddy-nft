/* eslint-disable node/no-missing-import */
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";
import { AddressStorage, Storage } from "../util/storage";
import { REGISTRY_ADDRESS } from "../util/const.json";
import { Astrobuddy } from "../../typechain-types";
import { readFileSync } from "fs";

const file = readFileSync("./scripts/metadata.json", "utf8");
const metadata = () => {
	return `data:application/json,${encodeURIComponent(file)}`;
};

async function main() {
	const network = await ethers.provider.getNetwork();
	const storage = new Storage("addresses.json");
	const addresses: AddressStorage = storage.fetch(network.chainId);
	const { astro: astroAddress, stringLib: stringLibAddress, metadata: metadataAddress } = addresses;
	// We get the contract to deploy
	let astro: Astrobuddy;
	if (!stringLibAddress) {
		const StringLib = await ethers.getContractFactory("String");
		const stringLib = await StringLib.deploy();
		await stringLib.deployed();
		addresses.stringLib = stringLib.address;
		console.log("Library deployed!");
	}
	if (!addresses.stringLib) throw new Error("Cannot find String Library!");
	if (!astroAddress) {
		const Astrobuddy = await ethers.getContractFactory("Astrobuddy");
		astro = (await upgrades.deployProxy(Astrobuddy, [metadata(), REGISTRY_ADDRESS])) as Astrobuddy;
		await astro.deployed();
		addresses.astro = astro.address;
		console.log("Astrobuddy deployed to:", astro.address);
	} else {
		const Astrobuddy = await ethers.getContractFactory("Astrobuddy");
		astro = Astrobuddy.attach(astroAddress) as Astrobuddy;
	}
	if (!metadataAddress) {
		const Metadata = await ethers.getContractFactory("MetadataFactory", {
			libraries: { String: addresses.stringLib },
		});
		const metadata = await Metadata.deploy();
		await metadata.deployed();
		addresses.metadata = metadata.address;
		console.log("Metadata deployed!");
	}
	storage.save(network.chainId, addresses);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
