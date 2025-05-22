// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract GameReward is Ownable, Pausable {
    // The ERC20 token that will be distributed
    IERC20 public token;

    // Mapping of player addresses to their game points balance
    mapping(address => uint256) public gamePoints;

    // Exchange rate: how many game points = 1 token (with decimals)
    uint256 public exchangeRate;

    // Admins who can award points
    mapping(address => bool) public admins;

    // Events
    event PointsAwarded(address indexed player, uint256 amount);
    event PointsRedeemed(
        address indexed player,
        uint256 pointsAmount,
        uint256 tokenAmount
    );
    event ExchangeRateUpdated(uint256 newRate);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    constructor(
        address _tokenAddress,
        uint256 _initialExchangeRate
    ) Ownable(msg.sender) {
        require(_tokenAddress != address(0), "Token address cannot be zero");
        token = IERC20(_tokenAddress);
        exchangeRate = _initialExchangeRate;

        // Owner is also an admin by default
        admins[msg.sender] = true;
    }

    modifier onlyAdmin() {
        require(
            admins[msg.sender] || msg.sender == owner(),
            "Caller is not an admin"
        );
        _;
    }

    /**
     * @dev Award points to a player (admin only)
     * @param _player The address of the player receiving points
     * @param _amount The amount of points to award
     */
    function awardPoints(
        address _player,
        uint256 _amount
    ) external onlyAdmin whenNotPaused {
        require(_player != address(0), "Cannot award to zero address");
        gamePoints[_player] += _amount;
        emit PointsAwarded(_player, _amount);
    }

    /**
     * @dev Redeem points for tokens
     * @param _amount The amount of points to redeem
     */
    function redeemPoints(uint256 _amount) external whenNotPaused {
        require(
            gamePoints[msg.sender] >= _amount,
            "Insufficient points balance"
        );
        require(_amount > 0, "Amount must be greater than zero");

        uint256 tokenAmount = (_amount * (10 ** 18)) / exchangeRate;
        require(tokenAmount > 0, "Token amount too small");

        // Check contract has enough tokens
        uint256 contractBalance = token.balanceOf(address(this));
        require(
            contractBalance >= tokenAmount,
            "Contract has insufficient tokens"
        );

        // Update points balance
        gamePoints[msg.sender] -= _amount;

        // Transfer tokens
        require(
            token.transfer(msg.sender, tokenAmount),
            "Token transfer failed"
        );

        emit PointsRedeemed(msg.sender, _amount, tokenAmount);
    }

    /**
     * @dev Set the exchange rate (owner only)
     * @param _newRate New exchange rate (points per token)
     */
    function setExchangeRate(uint256 _newRate) external onlyOwner {
        require(_newRate > 0, "Exchange rate must be greater than zero");
        exchangeRate = _newRate;
        emit ExchangeRateUpdated(_newRate);
    }

    /**
     * @dev Add an admin (owner only)
     * @param _admin Address to add as admin
     */
    function addAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Admin address cannot be zero");
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    /**
     * @dev Remove an admin (owner only)
     * @param _admin Address to remove as admin
     */
    function removeAdmin(address _admin) external onlyOwner {
        require(admins[_admin], "Address is not an admin");
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    /**
     * @dev Pause the contract (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Withdraw tokens from the contract (owner only)
     * @param _amount Amount of tokens to withdraw
     */
    function withdrawTokens(uint256 _amount) external onlyOwner {
        require(token.transfer(owner(), _amount), "Token transfer failed");
    }

    /**
     * @dev Get the token amount for given points
     * @param _points Amount of points to check
     * @return Amount of tokens that would be received
     */
    function getTokenAmount(uint256 _points) external view returns (uint256) {
        return (_points * (10 ** 18)) / exchangeRate;
    }

    /**
     * @dev Get the points balance of a player
     * @param _player Address to check
     * @return Points balance
     */
    function getPointsBalance(address _player) external view returns (uint256) {
        return gamePoints[_player];
    }
}
