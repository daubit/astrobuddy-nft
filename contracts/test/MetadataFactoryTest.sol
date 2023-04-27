// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
import "../MetadataFactory.sol";

contract MetadataFactoryTest is MetadataFactory {
    function tokenURI(
        uint256 internalId
    ) external pure override returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "Astro-Buddy%20Upgrade%20%23",
                    Strings.toString(internalId)
                )
            );
    }
}
