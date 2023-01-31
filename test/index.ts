import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Astrobuddy, MetadataFactory } from "../typechain-types";
import CONST from "../scripts/util/const.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { readFileSync, writeFileSync } from "fs";
import upload from "../scripts/upload";

const { REGISTRY_ADDRESS, ADMIN_ROLE } = CONST;
const PREFIX = "data:application/json,"

const file = readFileSync("./scripts/util/metadata.json", "utf8")
const metadataEncoded = () => {
	return `data:application/json,${encodeURIComponent(file)}`
}

describe("Astrobuddy", function () {
	let astro: Astrobuddy;
	let metadata: MetadataFactory;
	let admin: SignerWithAddress;
	let userA: SignerWithAddress;
	before(async () => {
		const StringLib = await ethers.getContractFactory("String");
		const stringLib = await StringLib.deploy();
		await stringLib.deployed();
		const Blyat = await ethers.getContractFactory("Astrobuddy");
		const Metadata = await ethers.getContractFactory("MetadataFactory", {
			libraries: { String: stringLib.address },
		});
		astro = (await upgrades.deployProxy(Blyat, [metadataEncoded(), REGISTRY_ADDRESS])) as Astrobuddy;
		metadata = (await Metadata.deploy()) as MetadataFactory;
		await astro.deployed();

		const signers = await ethers.getSigners();
		admin = signers[0];
		userA = signers[1];
	});
	describe("Deployment", function () {
		it("should have contract cid", async () => {
			const metadata = await astro.contractCID()
			const decoded = decodeURIComponent(metadata)
			expect(decoded.startsWith(PREFIX)).to.be.true;
			const data = JSON.parse(decoded.replace(PREFIX, ""))
			expect(data).to.not.be.undefined
			expect(data.name).to.not.be.undefined
			expect(data.description).to.not.be.undefined
		})
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
			it("should be able to transfer now", async () => {
				await time.increaseTo(fiveMinPeriod);
				const transferTx = await astro.connect(userA).transferFrom(userA.address, admin.address, 1);
				await transferTx.wait();
				const balance = await astro.balanceOf(admin.address);
				expect(balance.toNumber()).to.be.equal(1);
			});
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
				const token = JSON.parse(decoded.replace(PREFIX, ""))
				expect(token).to.not.be.undefined
				writeFileSync("dist/token-0.txt", tokenURI, "utf-8");
			});
		});
	});
});
