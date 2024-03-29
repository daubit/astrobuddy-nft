import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Astrobuddy, MetadataFactory, MetadataFactoryTest, Random } from "../typechain-types";
import CONST from "../scripts/util/const.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { readFileSync, writeFileSync } from "fs";
import upload from "../scripts/upload";
import { formatBytes32String, keccak256 } from "ethers/lib/utils";
import { Base64 } from "js-base64";

const { REGISTRY_ADDRESS, ADMIN_ROLE } = CONST;
const PREFIX = "data:application/json,";
const PREFIX_IMAGE = "data:image/svg+xml;base64,";

const file = readFileSync("./scripts/metadata.json", "utf8");
const metadataEncoded = () => {
	return `data:application/json,${encodeURIComponent(file)}`;
};

describe("Astrobuddy", function () {
	let astro: Astrobuddy;
	let metadata: MetadataFactory;
	let metadataTest: MetadataFactoryTest;
	let random: Random;
	let admin: SignerWithAddress;
	let userA: SignerWithAddress;
	const setup = async () => {
		const StringLib = await ethers.getContractFactory("String");
		const stringLib = await StringLib.deploy();
		await stringLib.deployed();
		const Blyat = await ethers.getContractFactory("Astrobuddy");
		const Metadata = await ethers.getContractFactory("MetadataFactory", {
			libraries: { String: stringLib.address },
		});
		const MetadataTest = await ethers.getContractFactory("MetadataFactoryTest", {
			libraries: { String: stringLib.address },
		});
		const Random = await ethers.getContractFactory("Random", {
			libraries: { String: stringLib.address },
		});
		astro = (await upgrades.deployProxy(Blyat, [metadataEncoded(), REGISTRY_ADDRESS])) as Astrobuddy;
		metadata = (await upgrades.deployProxy(Metadata, [], { unsafeAllowLinkedLibraries: true })) as MetadataFactory;
		metadataTest = (await upgrades.deployProxy(MetadataTest, [], {
			unsafeAllowLinkedLibraries: true,
		})) as MetadataFactoryTest;
		random = (await upgrades.deployProxy(Random, [], { unsafeAllowLinkedLibraries: true })) as Random;
		await astro.deployed();
		await metadata.deployed();
		await metadataTest.deployed();
		await random.deployed();

		const signers = await ethers.getSigners();
		admin = signers[0];
		userA = signers[1];
	};
	before(setup);
	describe("Deployment", function () {
		it("should have contract cid", async () => {
			const metadata = await astro.contractCID();
			const decoded = decodeURIComponent(metadata);
			expect(decoded.startsWith(PREFIX)).to.be.true;
			const data = JSON.parse(decoded.replace(PREFIX, ""));
			expect(data).to.not.be.undefined;
			expect(data.name).to.not.be.undefined;
			expect(data.description).to.not.be.undefined;
		});
		it("should have admin", async () => {
			const hasRole = await astro.hasRole(ADMIN_ROLE, admin.address);
			expect(hasRole).to.be.true;
		});
	});
	describe("NFT", function () {
		describe("Adding Itmes", () => {
			it("should be should to add an unlimited item", async () => {
				const addTx = await astro["addItem(address)"](metadata.address);
				await addTx.wait();
				const maxSupply = await astro.getItemMaxSupply(1);
				expect(maxSupply.toNumber()).to.be.equal(0);
			});
			it("should be should to add an limited item", async () => {
				const addTx = await astro["addItem(address,uint256)"](metadata.address, 3);
				await addTx.wait();
				const maxSupply = await astro.getItemMaxSupply(2);
				expect(maxSupply.toNumber()).to.be.equal(3);
			});
			it("should be NOT able for user to add an limited item", async () => {
				const addTx = astro.connect(userA)["addItem(address,uint256)"](metadata.address, 3);
				expect(addTx).to.be.reverted;
			});
			it("should be NOT able for user to add an unlimited item", async () => {
				const addTx = astro.connect(userA)["addItem(address)"](metadata.address);
				expect(addTx).to.be.reverted;
			});
		});
		describe("Mint", () => {
			it("should be able to mint unlimited", async () => {
				await astro.mint(1, userA.address);
				const balance = await astro.balanceOf(userA.address);
				const itemId = await astro.getItem(0);
				expect(balance.toNumber()).to.be.equal(1);
				expect(itemId.toNumber()).to.be.equal(1);
			});
			it("should be able to mint limited", async () => {
				await astro.mint(1, userA.address);
				const balance = await astro.balanceOf(userA.address);
				const itemId = await astro.getItem(0);
				expect(balance.toNumber()).to.be.equal(2);
				expect(itemId.toNumber()).to.be.equal(1);
			});
			it("should returns getters correctly", async () => {
				const internal1 = await astro.getInternalItemId(1);
				const totalSup1 = await astro.getItemTotalSupply(1);
				expect(internal1.toNumber()).to.be.equal(1);
				expect(totalSup1.toNumber()).to.be.equal(2);

				await astro.mint(2, userA.address);
				const balance = await astro.balanceOf(userA.address);
				const itemId = await astro.getItem(2);
				expect(balance.toNumber()).to.be.equal(3);
				expect(itemId.toNumber()).to.be.equal(2);

				const internal2 = await astro.getInternalItemId(2);
				const totalSup2 = await astro.getItemTotalSupply(2);
				expect(internal2.toNumber()).to.be.equal(0);
				expect(totalSup2.toNumber()).to.be.equal(1);
			});
			it("should NOT able for user to mint", async () => {
				const mintTx = astro.mint(1, userA.address, { from: userA.address });
				expect(mintTx).to.be.reverted;
			});
		});
		describe("Burn", () => {
			it("should be able to burn", async () => {
				const burnTx = await astro.connect(userA).burn(0);
				await burnTx.wait();
				const balance = await astro.balanceOf(userA.address);
				expect(balance.toNumber()).to.be.equal(2);
			});
			it("should NOT be able for user to burn", async () => {
				const burnTx = astro.burn(1, { from: userA.address });
				expect(burnTx).to.be.reverted;
			});
		});
	});
	describe("Lock Period", function () {
		describe("should restrain items from transfer", function () {
			const fiveMinPeriod = Date.now() + 1000 * 60 * 5;
			it("should have a correct setup", async () => {
				const addItemTx = await astro["addItem(address)"](metadata.address);
				await addItemTx.wait();
				const lockTx = await astro.setLockPeriod(3, fiveMinPeriod);
				await lockTx.wait();
				const mintTx = await astro.mint(3, userA.address);
				await mintTx.wait();
				const balanceUser = await astro.balanceOf(userA.address);
				const balanceAdmin = await astro.balanceOf(admin.address);
				expect(balanceUser.toNumber()).to.be.equal(3, "User balance is incorrect!");
				expect(balanceAdmin.toNumber()).to.be.equal(0, "Admin balance is incorrect!");
			});
			it("should NOT be able to transfer", async () => {
				const transferTx = astro.connect(userA).transferFrom(userA.address, admin.address, 0);
				expect(transferTx).to.be.reverted;
			});
			it("should be able to transfer as Admin", async () => {
				const mintTx = await astro.mint(3, admin.address);
				await mintTx.wait();

				const transferTx = await astro.connect(admin).transferFrom(admin.address, userA.address, 4);
				await transferTx.wait();

				const balance = await astro.balanceOf(userA.address);
				expect(balance.toNumber()).to.be.equal(4);
			});
			it("should be able to transfer now", async () => {
				await time.increaseTo(fiveMinPeriod);
				const transferTx = await astro.connect(userA).transferFrom(userA.address, admin.address, 1);
				await transferTx.wait();
				const balance = await astro.balanceOf(admin.address);
				expect(balance.toNumber()).to.be.equal(1);
			});
		});
	});
	describe("Freemint", () => {
		it("freemint should be off by default", async () => {
			const freemintAmount = await astro.getFreemintAmount(1);
			expect(freemintAmount.toNumber()).to.be.equal(0);
		});
		it("can enable freemint", async () => {
			await astro.setFreemintAmount(1, 1);
			const freemintAmount = await astro.getFreemintAmount(1);
			expect(freemintAmount.toNumber()).to.be.equal(1);
		});
		it("can freemint", async () => {
			await astro.connect(userA).freemint(1);
			const balance = await astro.balanceOf(userA.address);
			expect(balance.toNumber()).to.be.equal(4);
		});
		it("cannot freemint mor than allowd amount", async () => {
			const mintTx = astro.connect(userA).freemint(1);
			expect(mintTx).to.be.reverted;
		});
	});
	describe("Metadata", () => {
		describe("Setup", function () {
			it("should upload data", async function () {
				const ROOT_FOLDER = "assets";
				await upload(metadata, ROOT_FOLDER);
			});
		});
		describe("TokenURI", () => {
			it("should return the corrent token URI", async function () {
				const tokenURI = await metadata.tokenURI(0, { gasLimit: 30_000_000 });
				const decoded = decodeURIComponent(tokenURI);
				expect(decoded.startsWith(PREFIX)).to.be.true;
				const token = JSON.parse(decoded.replace(PREFIX, ""));
				expect(token).to.not.be.undefined;
				const imageURI = token.image_data;
				const decodedImage = decodeURIComponent(imageURI);
				writeFileSync("dist/image.txt", decodedImage, "utf-8");
				const image = Base64.fromBase64(decodedImage.replace(PREFIX_IMAGE, ""));
				writeFileSync("dist/image.svg", image, "utf-8");
				expect(image).to.not.be.undefined;
				writeFileSync("dist/token.txt", tokenURI, "utf-8");
			});
		});
	});
	describe("Random", () => {
		it("should be random", async function () {
			const result: { [index: number]: number } = {};
			for (let i = 0; i < 1000; i++) {
				const seed = keccak256(formatBytes32String(i.toString()));
				const randIndex = (await random.randomIndex(seed, 10, 0)).toNumber();
				if (result[randIndex]) {
					result[randIndex]++;
				} else {
					result[randIndex] = 1;
				}
			}
			// console.log(result);
		});
		it("should be random 2", async function () {
			const result: { [index: number]: number } = {};
			const seed = keccak256(formatBytes32String("1"));
			for (let i = 0; i < 32; i++) {
				const randIndex = (await random.randomIndex(seed, 10, i * 8)).toNumber();
				if (result[randIndex]) {
					result[randIndex]++;
				} else {
					result[randIndex] = 1;
				}
			}
			// console.log(result);
		});
	});
	before(setup);
	describe("Add multiple items", async () => {
		it("should be different", async () => {
			let addTx;
			addTx = await astro["addItem(address)"](metadata.address);
			await addTx.wait();
			addTx = await astro["addItem(address)"](metadataTest.address);
			await addTx.wait();
			let mintTx;
			mintTx = await astro.mint(1, userA.address);
			await mintTx.wait();
			mintTx = await astro.mint(2, userA.address);
			await mintTx.wait();
			const tokenURI1 = await metadata.tokenURI(1);
			const tokenURI2 = await metadataTest.tokenURI(1);
			expect(tokenURI1).to.be.not.eq(tokenURI2);
		});
	});
});
