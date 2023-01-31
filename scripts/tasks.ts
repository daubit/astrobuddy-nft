/* eslint-disable node/no-missing-import */
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { Storage } from "./util/storage";
import { HardhatRuntimeEnvironment } from "hardhat/types";
// @ts-ignore
import { Astrobuddy, MetadataFactory } from "../typechain-types";
import { readdirSync, writeFileSync } from "fs";
import { BigNumber } from "ethers";
import { uploadAttributes, uploadVariants } from "./upload";
import uploadAllHelper from "./upload";

interface MintArgs {
	to: string;
	seasonid: string;
}

interface UploadArgs {
	start: number;
	end: number;
	layer: number;
	startid: number;
}

interface TokenArgs {
	id: string;
}

export async function addAttributes(args: any, hre: HardhatRuntimeEnvironment) {
	const network = await hre.ethers.provider.getNetwork();
	const storage = new Storage("addresses.json");
	const { stringLib: stringLibAddress, metadata: metadataAddress } = storage.fetch(network.chainId);
	const Metadata = await hre.ethers.getContractFactory("MetadataFactory", {
		libraries: { String: stringLibAddress },
	});
	const metadata = Metadata.attach(metadataAddress) as MetadataFactory;
	const ROOT_FOLDER = "assets";
	await uploadAttributes(metadata, ROOT_FOLDER);
}

export async function setDescription(args: any, hre: HardhatRuntimeEnvironment) {
	const network = await hre.ethers.provider.getNetwork();
	const storage = new Storage("addresses.json");
	const { stringLib: stringLibAddress, metadata: metadataAddress } = storage.fetch(network.chainId);
	const Metadata = await hre.ethers.getContractFactory("MetadataFactory", {
		libraries: { String: stringLibAddress },
	});
	const metadata = Metadata.attach(metadataAddress) as MetadataFactory;
	const setDescriptionTx = await metadata.setDescription('Astro-Buddy has now arrived on the blockchain. And for real! This NFT is procedurally generated on the Blockchain and not a boring image rotting on a cheap server. No! Our Astro-Buddy is strong and powerful... and sad when you poke him in the eye. - This Astro-Buddy NFT is part of the "FU*K YOU, CRYPTO!" book project.');
	await setDescriptionTx.wait();
	console.log("Set description!");
}

export async function reset(args: UploadArgs, hre: HardhatRuntimeEnvironment) {
	const network = await hre.ethers.provider.getNetwork();
	const storage = new Storage("addresses.json");
	const { stringLib: stringLibAddress, metadata: metadataAddress } = storage.fetch(network.chainId);
	const Metadata = await hre.ethers.getContractFactory("MetadataFactory", {
		libraries: { String: stringLibAddress },
	});
	const { start, end, layer: layerId, startid } = args;
	const metadata = Metadata.attach(metadataAddress) as MetadataFactory;
	interface Variant {
		name: string;
		svg: string;
	}
	const ROOT_FOLDER = "assets";
	let layers = readdirSync(ROOT_FOLDER);
	if (layerId > 0) {
		const chosenLayer = layers.find((layer) => layer.includes(layerId.toString()));
		layers = chosenLayer ? [chosenLayer] : layers;
	}
	for (const layer of layers) {
		const attributesFolder = readdirSync(`${ROOT_FOLDER}/${layer}`).slice(start, end);
		for (let i = 0; i < attributesFolder.length; i++) {
			const attribute = attributesFolder[i];
			const attributeId = i + 1 + +startid;
			console.log(`Removing attribute ${attributeId}`)
			const variants: Variant[] = readdirSync(`${ROOT_FOLDER}/${layer}/${attribute}`).map((file) => ({
				name: file.replace(".html", ""),
				svg: "",
			}));
			for (const variant of variants) {
				const { svg, name } = variant;
				const setVariantTx = await metadata.setVariant(attributeId, name, svg);
				await setVariantTx.wait();
			}
			console.log(`Resetting ${attribute}`);
		}
	}
}

export async function uploadAll(args: UploadArgs, hre: HardhatRuntimeEnvironment) {
	const network = await hre.ethers.provider.getNetwork();
	const storage = new Storage("addresses.json");
	const { stringLib: stringLibAddress, metadata: metadataAddress } = storage.fetch(network.chainId);
	const Metadata = await hre.ethers.getContractFactory("MetadataFactory", {
		libraries: { String: stringLibAddress },
	});
	const metadata = Metadata.attach(metadataAddress) as MetadataFactory;
	const ROOT_FOLDER = "assets";
	await uploadAllHelper(metadata, ROOT_FOLDER);
}

export async function upload(args: UploadArgs, hre: HardhatRuntimeEnvironment) {
	const network = await hre.ethers.provider.getNetwork();
	const storage = new Storage("addresses.json");
	const { stringLib: stringLibAddress, metadata: metadataAddress } = storage.fetch(network.chainId);
	const Metadata = await hre.ethers.getContractFactory("MetadataFactory", {
		libraries: { String: stringLibAddress },
	});
	const { start, end, layer, startid } = args;
	const metadata = Metadata.attach(metadataAddress) as MetadataFactory;
	const ROOT_FOLDER = "assets";
	await uploadVariants(metadata, ROOT_FOLDER, { start, end, layer, startid });
}


export async function mint(args: MintArgs, hre: HardhatRuntimeEnvironment) {
	const network = await hre.ethers.provider.getNetwork();
	const storage = new Storage("addresses.json");
	const { astro: astroAddress } = storage.fetch(network.chainId);
	const { to, seasonid: itemId } = args;
	const Astrobuddy = await hre.ethers.getContractFactory("Astrobuddy");
	const astro = Astrobuddy.attach(astroAddress) as Astrobuddy;
	const mintTx = await astro.mint(BigNumber.from(itemId), to);
	await mintTx.wait();
	console.log(`https://${network.chainId === 80001 ? "mumbai." : ""}polygonscan.com/tx/${mintTx.hash}`);
}

export async function tokenURI(args: TokenArgs, hre: HardhatRuntimeEnvironment) {
	const network = await hre.ethers.provider.getNetwork();
	const storage = new Storage("addresses.json");
	const { astro: astroAddress, stringLib: stringLibAddress } = storage.fetch(network.chainId);
	const { id: tokenId } = args;
	const Astrobuddy = await hre.ethers.getContractFactory("Astrobuddy");
	const astro = Astrobuddy.attach(astroAddress) as Astrobuddy;
	// const tokenURI = await metadata.tokenURI(tokenId);
	// writeFileSync("token.txt", tokenURI, "utf-8");
	const tx = await astro.tokenURI(tokenId);
	console.log(tx);
}
