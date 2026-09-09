// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISharedBondingCurve {
    function createMarket(string calldata name, string calldata symbol, uint256 basePrice, uint256 slope, uint256 maxSupply, uint32 decimals) external payable returns (uint256, address);
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

    function createMarket(string calldata name, string calldata symbol, uint256 basePrice, uint256 slope, uint256 maxSupply, uint32 decimals) external payable onlyOwner returns (uint256 marketId) {
        address token;
        (marketId, token) = protocol.createMarket{value: msg.value}(name, symbol, basePrice, slope, maxSupply, decimals);
        emit MarketRegistered(marketId, msg.sender, token);
    }
}