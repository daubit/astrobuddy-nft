// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "./lib/IMetadataFactory.sol";
import "./lib/String.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MetadataFactory is IMetadataFactory, AccessControlUpgradeable {
    using String for string;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private _attributeCounter;

    string private _description;
    // Id => Attribute
    mapping(uint256 => string) private _attributes;
    // AttributeId => Variant => Id
    mapping(uint256 => mapping(string => uint256)) private _indexedVariant;
    // AttributeId => Variant Amount
    mapping(uint256 => CountersUpgradeable.Counter) private _variantCounter;
    // AttributeId => VariantId => Variant
    mapping(uint256 => mapping(uint256 => string)) private _variantName;
    // AttributeId => VariantId => Attribute
    mapping(uint256 => mapping(uint256 => string)) private _variantKind;
    // AttributeId => VariantId => svg
    mapping(uint256 => mapping(uint256 => string)) private _svg;

    error ZeroValue();
    error EmptyString();
    error UnequalArrays();

    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function tokenURI(uint256 tokenId) virtual external view returns (string memory) {
        bytes32 seed = keccak256(abi.encodePacked(tokenId));
        string[] memory variants = _collectVariants(seed);
        bytes memory attributes = _generateAttributes(variants);
        bytes memory image = _generateImage(variants);
        bytes memory name = _getName(tokenId);
        return
            string(
                abi.encodePacked(
                    "data:application/json,%7B%22name%22%3A%22",
                    name,
                    "%22%2C",
                    "%22description%22%3A%22",
                    _description,
                    "%22%2C",
                    "%22attributes%22%3A",
                    attributes,
                    "%2C",
                    "%22image_data%22%3A%22data%3Aimage%2Fsvg%2Bxml%3Bbase64%2C",
                    image,
                    "%22%2C",
                    "%22animation_url%22%3A%22data%3Aimage%2Fsvg%2Bxml%3Bbase64%2C",
                    image,
                    "%22%7D"
                )
            );
    }

    function setDescription(string memory description)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _description = description;
    }

    function setVariant(
        uint256 attributeId,
        string memory variant,
        string memory svg
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 variantId = _indexedVariant[attributeId][variant];
        if (variantId == 0) {
            _variantCounter[attributeId].increment();
            variantId = _variantCounter[attributeId].current();
            _indexedVariant[attributeId][variant] = variantId;
            _variantName[attributeId][variantId] = variant;
            _variantKind[attributeId][variantId] = _attributes[attributeId];
        }
        _svg[attributeId][variantId] = svg;
    }

    function addVariants(
        uint256 attributeId,
        string[] memory variants,
        string[] memory svgs
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (variants.length != svgs.length) revert UnequalArrays();
        string memory attribute = _attributes[attributeId];
        for (uint256 i; i < variants.length; i++) {
            string memory variant = variants[i];
            uint256 variantId = _indexedVariant[attributeId][variant];
            if (variantId == 0) {
                _variantCounter[attributeId].increment();
                variantId = _variantCounter[attributeId].current();
                _indexedVariant[attributeId][variant] = variantId;
                _variantName[attributeId][variantId] = variant;
                _svg[attributeId][variantId] = svgs[i];
                _variantKind[attributeId][variantId] = attribute;
            }
        }
    }

    function addVariantChunked(
        uint256 attributeId,
        string memory variant,
        string memory svgChunk
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 variantId = _indexedVariant[attributeId][variant];
        if (variantId == 0) {
            _variantCounter[attributeId].increment();
            variantId = _variantCounter[attributeId].current();
            _indexedVariant[attributeId][variant] = variantId;
            _variantName[attributeId][variantId] = variant;
            _variantKind[attributeId][variantId] = _attributes[attributeId];
        }
        _svg[attributeId][variantId] = _svg[attributeId][variantId].concat(
            svgChunk
        );
    }

    function getVariantIndex(uint256 attributeId, string memory variant)
        external
        view
        returns (uint256)
    {
        require(!variant.equals(""), "Empty string");
        require(
            attributeId > 0 && attributeId <= _attributeCounter.current(),
            "Invalid attribute"
        );
        return _indexedVariant[attributeId][variant];
    }

    function addAttribute(string memory attribute)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _attributeCounter.increment();
        _attributes[_attributeCounter.current()] = attribute;
    }

    function addAttributes(string[] memory attributes)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        for (uint256 i; i < attributes.length; i++) {
            _attributeCounter.increment();
            _attributes[_attributeCounter.current()] = attributes[i];
        }
    }

    function getAttribute(uint256 id) external view returns (string memory) {
        return _attributes[id];
    }

    function _randomIndex(
        bytes32 seed,
        uint256 max,
        uint256 offset
    ) internal pure returns (uint256) {
        // 0xFF = 0b1111_1111
        uint256 info = (uint256(seed) >> offset) & 0xFF;
        return info % max;
    }

    function _collectVariants(bytes32 seed)
        internal
        view
        returns (string[] memory)
    {
        uint256 currentAmount = _attributeCounter.current();
        string[] memory variants = new string[](currentAmount);
        for (uint256 i; i < currentAmount; i++) {
            uint256 attributeId = i + 1;
            uint256 variantAmount = _variantCounter[attributeId].current();
            uint256 randomIndex = _randomIndex(seed, variantAmount, i * 8) + 1;
            variants[i] = _variantName[attributeId][randomIndex];
        }
        return variants;
    }

    function _generateAttributes(string[] memory variants)
        internal
        view
        returns (bytes memory)
    {
        bytes memory base;
        for (uint16 i; i < variants.length; i++) {
            uint256 attributeId = i + 1;
            uint256 variantId = _indexedVariant[attributeId][variants[i]];
            string memory variantType = _variantKind[attributeId][variantId];
            if (bytes(variantType)[0] == "_") {
                continue;
            }
            if (i < _attributeCounter.current() - 1) {
                // assumes that there will ALWAYS be an element with _ at the end otherwise reverts
                if (
                    bytes(
                        _variantKind[i + 2][
                            _indexedVariant[i + 2][variants[i + 1]]
                        ]
                    )[0] == "_"
                ) {
                    base = abi.encodePacked(
                        base,
                        "%7B%22trait_type%22%3A%22",
                        _variantKind[attributeId][variantId],
                        "%22%2C%22value%22%3A%22",
                        variants[i],
                        "%22%7D"
                    );
                } else {
                    base = abi.encodePacked(
                        base,
                        "%7B%22trait_type%22%3A%22",
                        _variantKind[attributeId][variantId],
                        "%22%2C%22value%22%3A%22",
                        variants[i],
                        "%22%7D%2C"
                    );
                }
            } else {
                base = abi.encodePacked(
                    base,
                    "%7B%22trait_type%22%3A%22",
                    _variantKind[attributeId][variantId],
                    "%22%2C%22value%22%3A%22",
                    variants[i],
                    "%22%7D"
                );
            }
        }
        return abi.encodePacked("%5B", base, "%5D");
    }

    function _getName(uint256 internalId) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                "Astro-Buddy%20Blyatversity%20%23",
                Strings.toString(internalId)
            );
    }

    function _generateImage(string[] memory variants)
        internal
        view
        returns (bytes memory)
    {
        bytes memory base;
        uint256 amount = variants.length;
        uint256[] memory variantIds = new uint256[](amount);
        uint32 i = 0;
        while (i < amount) {
            if ((amount - i) % 5 == 0) {
                variantIds[i + 0] = _indexedVariant[i + 1][variants[i + 0]];
                variantIds[i + 1] = _indexedVariant[i + 2][variants[i + 1]];
                variantIds[i + 2] = _indexedVariant[i + 3][variants[i + 2]];
                variantIds[i + 3] = _indexedVariant[i + 4][variants[i + 3]];
                variantIds[i + 4] = _indexedVariant[i + 5][variants[i + 4]];
                base = abi.encodePacked(
                    base,
                    _svg[i + 1][variantIds[i + 0]],
                    _svg[i + 2][variantIds[i + 1]],
                    _svg[i + 3][variantIds[i + 2]],
                    _svg[i + 4][variantIds[i + 3]],
                    _svg[i + 5][variantIds[i + 4]]
                );
                i += 5;
            } else {
                variantIds[i] = _indexedVariant[i + 1][variants[i]];
                base = abi.encodePacked(base, _svg[i + 1][variantIds[i]]);
                i++;
            }
        }
        base = abi.encodePacked(
            "PHN2ZyB3aWR0aD0nMTAwMCcgaGVpZ2h0PScxMDAwJyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHhtbG5zOnhsaW5rPSdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJyB2aWV3Qm94PScwIDAgMTAwMCAxMDAwJz4g",
            base,
            "PC9zdmc+"
        );
        // "<svg width='1000' height='1000' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 1000 1000'>"
        //base.concat("</svg>");
        return base;
    }
}
