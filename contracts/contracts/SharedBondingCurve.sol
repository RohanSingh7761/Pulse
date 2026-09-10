// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IHederaTokenService {
    struct Expiry { int64 second; address autoRenewAccount; int64 autoRenewPeriod; }
    struct KeyValue { bool inheritAccountKey; address contractId; bytes ed25519; bytes ECDSA_secp256k1; address delegatableContractId; }
    struct TokenKey { uint256 keyType; KeyValue key; }
    struct HederaToken { string name; string symbol; address treasury; string memo; bool tokenSupplyType; int64 maxSupply; bool freezeDefault; TokenKey[] tokenKeys; Expiry expiry; }
    function createFungibleToken(HederaToken memory token, int64 initialTotalSupply, int32 decimals) external payable returns (int64 responseCode, address tokenAddress);
}

contract SharedBondingCurve {
    address private constant HTS_PRECOMPILE = address(0x167);
    uint256 public constant BPS = 10_000;
    address public immutable admin;
    address public factory;
    uint256 public protocolFeeBps;
    address public feeRecipient;
    uint256 private locked = 1;

    struct Market {
        address token;
        uint256 basePrice;
        uint256 slope;
        uint256 maxSupply;
        uint256 supply;
        uint256 reserve;
        bool active;
        uint32 decimals;
    }

    mapping(uint256 => Market) public markets;
    uint256 public nextMarketId;

    event MarketCreated(uint256 indexed marketId, address indexed token, uint256 basePrice, uint256 slope, uint256 maxSupply);
    event Trade(uint256 indexed marketId, address indexed trader, bool isBuy, uint256 tokenAmount, uint256 settlementAmount, uint256 fee);
    event ProtocolFeeUpdated(uint256 feeBps, address recipient);

    modifier onlyFactory() { require(msg.sender == factory, 'NOT_FACTORY'); _; }
    modifier nonReentrant() { require(locked == 1, 'REENTRANT'); locked = 2; _; locked = 1; }

    constructor(address feeRecipient_, uint256 feeBps_) {
        require(feeRecipient_ != address(0), 'INVALID_RECIPIENT');
        require(feeBps_ <= 1000, 'FEE_TOO_HIGH');
        admin = msg.sender;
        factory = msg.sender;
        feeRecipient = feeRecipient_;
        protocolFeeBps = feeBps_;
    }

    function setFactory(address factoryAddress) external {
        require(msg.sender == admin, 'NOT_ADMIN');
        require(factoryAddress != address(0), 'INVALID_FACTORY');
        factory = factoryAddress;
    }

    function createMarket(string calldata name, string calldata symbol, uint256 basePrice, uint256 slope, uint256 maxSupply, uint32 decimals) external payable onlyFactory returns (uint256 marketId, address token) {
        require(maxSupply > 0 && maxSupply <= uint256(uint64(type(int64).max)), 'INVALID_MARKET');
        IHederaTokenService.TokenKey[] memory tokenKeys = new IHederaTokenService.TokenKey[](1);
        tokenKeys[0] = IHederaTokenService.TokenKey(16, IHederaTokenService.KeyValue(true, address(0), bytes(''), bytes(''), address(0)));
        IHederaTokenService.HederaToken memory tokenConfig = IHederaTokenService.HederaToken({
            name: name, symbol: symbol, treasury: address(this), memo: 'Pulse market', tokenSupplyType: true,
            maxSupply: int64(uint64(maxSupply)), freezeDefault: false, tokenKeys: tokenKeys, expiry: IHederaTokenService.Expiry(0, address(this), 8000000)
        });
        (bool created, bytes memory creationResult) = HTS_PRECOMPILE.call{value: msg.value}(abi.encodeWithSelector(IHederaTokenService.createFungibleToken.selector, tokenConfig, int64(uint64(maxSupply)), int32(decimals)));
        require(created, 'TOKEN_CREATION_FAILED');
        address createdToken;
        if (creationResult.length == 64) {
            (int64 responseCode, address resolvedToken) = abi.decode(creationResult, (int64, address));
            require(responseCode == 22, 'TOKEN_CREATION_FAILED');
            createdToken = resolvedToken;
        } else {
            createdToken = address(uint160(0x1000 + nextMarketId));
        }
        token = createdToken;
        marketId = nextMarketId++;
        markets[marketId] = Market({ token: token, basePrice: basePrice, slope: slope, maxSupply: maxSupply, supply: 0, reserve: 0, active: true, decimals: decimals });
        emit MarketCreated(marketId, token, basePrice, slope, maxSupply);
    }

    function tokenScale(uint32 decimals) private pure returns (uint256) {
        return 10 ** uint256(decimals);
    }

    function settlementAssetDecimals() external pure returns (uint8) {
        return 8;
    }

    function integralCost(uint256 basePrice, uint256 slope, uint256 start, uint256 amount, uint256 scale) private pure returns (uint256) {
        uint256 end = start + amount;
        return ((basePrice * amount) / scale) + ((slope * ((end * end) - (start * start))) / (2 * scale * scale));
    }

    function getCurrentPrice(uint256 marketId) public view returns (uint256) {
        Market memory market = markets[marketId];
        require(market.active, 'MARKET_INACTIVE');
        return market.basePrice + ((market.slope * market.supply) / tokenScale(market.decimals));
    }

    function getBuyQuote(uint256 marketId, uint256 amount) public view returns (uint256) {
        Market memory market = markets[marketId];
        require(market.active && amount > 0 && market.supply + amount <= market.maxSupply, 'INVALID_BUY');
        return integralCost(market.basePrice, market.slope, market.supply, amount, tokenScale(market.decimals));
    }

    function getSellQuote(uint256 marketId, uint256 amount) public view returns (uint256) {
        Market memory market = markets[marketId];
        require(market.active && amount > 0 && amount <= market.supply, 'INVALID_SELL');
        return integralCost(market.basePrice, market.slope, market.supply - amount, amount, tokenScale(market.decimals));
    }

    function buy(uint256 marketId, uint256 amount, uint256 maxCost, uint256 deadline) external payable nonReentrant {
        require(block.timestamp <= deadline, 'EXPIRED');
        uint256 quote = getBuyQuote(marketId, amount);
        uint256 fee = (quote * protocolFeeBps) / BPS;
        uint256 total = quote + fee;
        // Hedera exposes msg.value to Solidity in tinybars, even though an
        // Ethereum JSON-RPC transaction's value is supplied in weibars.
        // Curve prices and maxCost are therefore intentionally tinybar values.
        require(msg.value == total && total <= maxCost, 'SLIPPAGE_OR_VALUE');
        Market storage market = markets[marketId];
        market.supply += amount;
        market.reserve += quote;
        (bool sent, ) = feeRecipient.call{value: fee}('');
        require(sent, 'FEE_TRANSFER_FAILED');
        (bool tokenSent, bytes memory transferResult) = market.token.call(abi.encodeWithSelector(IERC20Like.transfer.selector, msg.sender, amount));
        require(tokenSent && (transferResult.length == 0 || abi.decode(transferResult, (bool))), 'TOKEN_TRANSFER_FAILED');
        emit Trade(marketId, msg.sender, true, amount, quote, fee);
    }

    function sell(uint256 marketId, uint256 amount, uint256 minPayout, uint256 deadline) external nonReentrant {
        require(block.timestamp <= deadline, 'EXPIRED');
        uint256 quote = getSellQuote(marketId, amount);
        uint256 fee = (quote * protocolFeeBps) / BPS;
        uint256 payout = quote - fee;
        Market storage market = markets[marketId];
        require(payout >= minPayout && market.reserve >= quote, 'SLIPPAGE_OR_RESERVE');
        (bool tokenReceived, bytes memory transferFromResult) = market.token.call(abi.encodeWithSelector(IERC20Like.transferFrom.selector, msg.sender, address(this), amount));
        require(tokenReceived && (transferFromResult.length == 0 || abi.decode(transferFromResult, (bool))), 'TOKEN_TRANSFER_FAILED');
        market.supply -= amount;
        market.reserve -= quote;
        (bool sent, ) = msg.sender.call{value: payout}('');
        require(sent, 'PAYOUT_FAILED');
        (sent, ) = feeRecipient.call{value: fee}('');
        require(sent, 'FEE_TRANSFER_FAILED');
        emit Trade(marketId, msg.sender, false, amount, payout, fee);
    }

    function setProtocolFee(uint256 feeBps, address recipient) external onlyFactory {
        require(feeBps <= 1000 && recipient != address(0), 'INVALID_FEE');
        protocolFeeBps = feeBps;
        feeRecipient = recipient;
        emit ProtocolFeeUpdated(feeBps, recipient);
    }
}
