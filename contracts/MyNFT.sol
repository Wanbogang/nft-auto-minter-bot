// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * ERC-721 sederhana (OZ v5) untuk latihan mint gratis.
 * - mint() => 1 NFT ke caller
 * - publicMint(uint256 quantity) => batch mint 1..10 ke caller
 */
contract MyNFT is ERC721, Ownable {
    uint256 private _nextTokenId = 1;

    constructor() ERC721("MyBaseSepoliaNFT", "MBSNFT") Ownable(msg.sender) {}

    function mint() external {
        _safeMint(msg.sender, _nextTokenId++);
    }

    function publicMint(uint256 quantity) external {
        require(quantity > 0 && quantity <= 10, "qty 1..10");
        for (uint256 i = 0; i < quantity; i++) {
            _safeMint(msg.sender, _nextTokenId++);
        }
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}

