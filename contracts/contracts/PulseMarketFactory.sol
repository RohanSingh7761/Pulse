// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISharedBondingCurve {
    function createMarket(address token, uint256 basePrice, uint256 slope, uint256 maxSupply) external returns (uint256);
    function setFactory(address factoryAddress) external;
}

contract PulseMarketFactory {
    address public immutable owner;
    ISharedBondingCurve public immutable protocol;

    event MarketRegistered(uint256 indexed marketId, address indexed creator, address token);

    modifier onlyOwner() { require(msg.sender == owner, 'NOT_OWNER'); _; }

    constructor(address protocolAddress) {
        require(protocolAddress != address(0), 'INVALID_PROTOCOL');
        owner = msg.sender;
        protocol = ISharedBondingCurve(protocolAddress);
    }

    function createMarket(address token, uint256 basePrice, uint256 slope, uint256 maxSupply) external onlyOwner returns (uint256 marketId) {
        marketId = protocol.createMarket(token, basePrice, slope, maxSupply);
        emit MarketRegistered(marketId, msg.sender, token);
    }
}