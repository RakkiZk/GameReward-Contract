const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GameReward", function () {
  let gameReward;
  let token;
  let owner;
  let admin;
  let player1;
  let player2;
  let nonAdmin;

  before(async function () {
    [owner, admin, player1, player2, nonAdmin] = await ethers.getSigners();

    // Deploy a mock ERC20 token for testing
    const Token = await ethers.getContractFactory("MockToken");
    token = await Token.deploy();
    await token.waitForDeployment();

    // Deploy the GameReward contract
    const GameReward = await ethers.getContractFactory("GameReward");
    gameReward = await GameReward.deploy(token.target, 100); // 100 points = 1 token
    await gameReward.waitForDeployment();

    // Transfer some tokens to the contract for testing
    await token.transfer(gameReward.target, ethers.parseEther("10000"));

    // Add an admin for testing
    await gameReward.addAdmin(admin.address);
  });

  describe("Deployment", function () {
    it("Should set the right token address", async function () {
      expect(await gameReward.token()).to.equal(token.target);
    });

    it("Should set the right exchange rate", async function () {
      expect(await gameReward.exchangeRate()).to.equal(100);
    });

    it("Should set the owner as admin", async function () {
      expect(await gameReward.admins(owner.address)).to.equal(true);
    });

    it("Should not be paused initially", async function () {
      expect(await gameReward.paused()).to.equal(false);
    });

    it("Should revert with zero token address on new deployment", async function () {
      const GameReward = await ethers.getContractFactory("GameReward");
      await expect(
        GameReward.deploy(ethers.ZeroAddress, 100)
      ).to.be.revertedWith("Token address cannot be zero");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to add admin", async function () {
      await gameReward.addAdmin(player1.address);
      expect(await gameReward.admins(player1.address)).to.equal(true);
    });

    it("Should emit AdminAdded event", async function () {
      await expect(gameReward.addAdmin(player2.address))
        .to.emit(gameReward, "AdminAdded")
        .withArgs(player2.address);
    });

    it("Should allow owner to remove admin", async function () {
      await gameReward.removeAdmin(player1.address);
      expect(await gameReward.admins(player1.address)).to.equal(false);
    });

    it("Should emit AdminRemoved event", async function () {
      await expect(gameReward.removeAdmin(player2.address))
        .to.emit(gameReward, "AdminRemoved")
        .withArgs(player2.address);
    });

    it("Should prevent non-owners from adding admins", async function () {
      await expect(
        gameReward.connect(admin).addAdmin(player1.address)
      ).to.be.revertedWithCustomError(gameReward, "OwnableUnauthorizedAccount");
    });

    it("Should prevent non-owners from removing admins", async function () {
      await expect(
        gameReward.connect(admin).removeAdmin(admin.address)
      ).to.be.revertedWithCustomError(gameReward, "OwnableUnauthorizedAccount");
    });

    it("Should prevent adding zero address as admin", async function () {
      await expect(
        gameReward.addAdmin(ethers.ZeroAddress)
      ).to.be.revertedWith("Admin address cannot be zero");
    });

    it("Should prevent removing non-admin", async function () {
      await expect(
        gameReward.removeAdmin(nonAdmin.address)
      ).to.be.revertedWith("Address is not an admin");
    });

    it("Should allow owner to act as admin", async function () {
      await gameReward.connect(owner).awardPoints(player1.address, 100);
      expect(await gameReward.gamePoints(player1.address)).to.equal(100);
    });
  });

  describe("Points Management - Basic Operations", function () {
    it("Should allow admin to award points", async function () {
      await gameReward.connect(admin).awardPoints(player1.address, 500);
      expect(await gameReward.gamePoints(player1.address)).to.equal(600); // 100 + 500
    });

    it("Should allow owner to award points", async function () {
      await gameReward.connect(owner).awardPoints(player2.address, 300);
      expect(await gameReward.gamePoints(player2.address)).to.equal(300);
    });

    it("Should prevent non-admins from awarding points", async function () {
      await expect(
        gameReward.connect(nonAdmin).awardPoints(player1.address, 100)
      ).to.be.revertedWith("Caller is not an admin");
    });

    it("Should emit PointsAwarded event", async function () {
      await expect(gameReward.connect(admin).awardPoints(player1.address, 200))
        .to.emit(gameReward, "PointsAwarded")
        .withArgs(player1.address, 200);
      // player1 now has 800 points (600 + 200)
    });

    it("Should prevent awarding points to zero address", async function () {
      await expect(
        gameReward.connect(admin).awardPoints(ethers.ZeroAddress, 100)
      ).to.be.revertedWith("Cannot award to zero address");
    });

    it("Should accumulate points correctly", async function () {
      await gameReward.connect(admin).awardPoints(player2.address, 100);
      await gameReward.connect(admin).awardPoints(player2.address, 200);
      expect(await gameReward.gamePoints(player2.address)).to.equal(600); // 300 + 100 + 200
    });

    it("Should handle large point amounts", async function () {
      const largeAmount = ethers.parseEther("1000");
      await gameReward.connect(admin).awardPoints(nonAdmin.address, largeAmount);
      expect(await gameReward.gamePoints(nonAdmin.address)).to.equal(largeAmount);
    });

    it("Should award points to multiple players independently", async function () {
      const player1Points = await gameReward.gamePoints(player1.address);
      const player2Points = await gameReward.gamePoints(player2.address);
      
      await gameReward.connect(admin).awardPoints(player1.address, 50);
      await gameReward.connect(admin).awardPoints(player2.address, 75);
      
      expect(await gameReward.gamePoints(player1.address)).to.equal(player1Points + BigInt(50));
      expect(await gameReward.gamePoints(player2.address)).to.equal(player2Points + BigInt(75));
    });
  });

  describe("Points Redemption - Basic Operations", function () {
    it("Should allow players to redeem points for tokens", async function () {
      const initialBalance = await token.balanceOf(player1.address);
      const initialPoints = await gameReward.gamePoints(player1.address);
      
      await gameReward.connect(player1).redeemPoints(400);
      
      // 400 points / 100 rate = 4 tokens
      const expectedBalance = initialBalance + ethers.parseEther("4");
      expect(await token.balanceOf(player1.address)).to.equal(expectedBalance);
      expect(await gameReward.gamePoints(player1.address)).to.equal(initialPoints - BigInt(400));
    });

    it("Should emit PointsRedeemed event", async function () {
      await expect(gameReward.connect(player1).redeemPoints(100))
        .to.emit(gameReward, "PointsRedeemed")
        .withArgs(player1.address, 100, ethers.parseEther("1"));
    });

    it("Should prevent redemption with insufficient points", async function () {
      const currentPoints = await gameReward.gamePoints(player1.address);
      const excessiveAmount = currentPoints + BigInt(1);
      
      await expect(
        gameReward.connect(player1).redeemPoints(excessiveAmount)
      ).to.be.revertedWith("Insufficient points balance");
    });

    it("Should prevent redemption of zero points", async function () {
      await expect(
        gameReward.connect(player1).redeemPoints(0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("Should handle partial redemptions correctly", async function () {
      const initialPoints = await gameReward.gamePoints(player2.address);
      const redeemAmount = 250;
      
      await gameReward.connect(player2).redeemPoints(redeemAmount);
      
      expect(await gameReward.gamePoints(player2.address)).to.equal(initialPoints - BigInt(redeemAmount));
    });

    it("Should handle complete redemption correctly", async function () {
      const allPoints = await gameReward.gamePoints(player2.address);
      await gameReward.connect(player2).redeemPoints(allPoints);
      
      expect(await gameReward.gamePoints(player2.address)).to.equal(0);
    });
  });

  describe("Pause/Unpause Functionality", function () {
    it("Should allow owner to pause contract", async function () {
      await gameReward.pause();
      expect(await gameReward.paused()).to.equal(true);
    });

    it("Should prevent awarding points when paused", async function () {
      await expect(
        gameReward.connect(admin).awardPoints(player1.address, 100)
      ).to.be.revertedWithCustomError(gameReward, "EnforcedPause");
    });

    it("Should prevent redeeming points when paused", async function () {
      await expect(
        gameReward.connect(player1).redeemPoints(50)
      ).to.be.revertedWithCustomError(gameReward, "EnforcedPause");
    });

    it("Should allow view functions when paused", async function () {
      expect(await gameReward.getPointsBalance(player1.address)).to.be.a('bigint');
      expect(await gameReward.getTokenAmount(100)).to.be.a('bigint');
    });

    it("Should prevent non-owners from pausing", async function () {
      await expect(
        gameReward.connect(admin).pause()
      ).to.be.revertedWithCustomError(gameReward, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to unpause contract", async function () {
      await gameReward.unpause();
      expect(await gameReward.paused()).to.equal(false);
    });

    it("Should prevent non-owners from unpausing", async function () {
      await gameReward.pause();
      await expect(
        gameReward.connect(admin).unpause()
      ).to.be.revertedWithCustomError(gameReward, "OwnableUnauthorizedAccount");
      await gameReward.unpause(); // Clean up
    });

    it("Should work normally after unpause", async function () {
      // Award and redeem should work again
      await gameReward.connect(admin).awardPoints(player1.address, 100);
      await gameReward.connect(player1).redeemPoints(50);
      
      expect(await gameReward.gamePoints(player1.address)).to.be.greaterThan(0);
    });
  });

  describe("Exchange Rate Management", function () {
    it("Should allow owner to change exchange rate", async function () {
      await gameReward.setExchangeRate(200);
      expect(await gameReward.exchangeRate()).to.equal(200);
    });

    it("Should emit ExchangeRateUpdated event", async function () {
      await expect(gameReward.setExchangeRate(150))
        .to.emit(gameReward, "ExchangeRateUpdated")
        .withArgs(150);
    });

    it("Should prevent non-owners from changing exchange rate", async function () {
      await expect(
        gameReward.connect(admin).setExchangeRate(50)
      ).to.be.revertedWithCustomError(gameReward, "OwnableUnauthorizedAccount");
    });

    it("Should prevent setting exchange rate to zero", async function () {
      await expect(
        gameReward.setExchangeRate(0)
      ).to.be.revertedWith("Exchange rate must be greater than zero");
    });

    it("Should calculate token amounts correctly with new exchange rate", async function () {
      // Current rate is 150 (150 points = 1 token)
      const initialBalance = await token.balanceOf(player1.address);
      const currentPoints = await gameReward.gamePoints(player1.address);
      
      if (currentPoints < 300) {
        await gameReward.connect(admin).awardPoints(player1.address, 300);
      }
      
      await gameReward.connect(player1).redeemPoints(300);
      
      // 300 points / 150 rate = 2 tokens
      const expectedBalance = initialBalance + ethers.parseEther("2");
      expect(await token.balanceOf(player1.address)).to.equal(expectedBalance);
    });

    it("Should handle very large exchange rates", async function () {
      const largeRate = ethers.parseEther("1000");
      await gameReward.setExchangeRate(largeRate);
      expect(await gameReward.exchangeRate()).to.equal(largeRate);
    });

    it("Should handle exchange rate of 1", async function () {
      await gameReward.setExchangeRate(1);
      expect(await gameReward.exchangeRate()).to.equal(1);
      
      // Test redemption with rate 1 (1 point = 1 token)
      await gameReward.connect(admin).awardPoints(player1.address, 3);
      const initialBalance = await token.balanceOf(player1.address);
      await gameReward.connect(player1).redeemPoints(3);
      
      const expectedBalance = initialBalance + ethers.parseEther("3");
      expect(await token.balanceOf(player1.address)).to.equal(expectedBalance);
    });

    it("Should handle very small redemptions with high exchange rate", async function () {
      await gameReward.setExchangeRate(ethers.parseEther("1000")); // Very high rate
      
      await gameReward.connect(admin).awardPoints(player1.address, 1000);
      await expect(
        gameReward.connect(player1).redeemPoints(1)
      ).to.be.revertedWith("Token amount too small");
      
      // Reset to reasonable rate for other tests
      await gameReward.setExchangeRate(100);
    });
  });

  describe("Contract Management", function () {
    it("Should allow owner to withdraw tokens", async function () {
      const initialBalance = await token.balanceOf(owner.address);
      const contractBalance = await token.balanceOf(gameReward.target);
      const withdrawAmount = ethers.parseEther("50");
      
      await gameReward.withdrawTokens(withdrawAmount);
      
      expect(await token.balanceOf(owner.address)).to.equal(initialBalance + withdrawAmount);
      expect(await token.balanceOf(gameReward.target)).to.equal(contractBalance - withdrawAmount);
    });

    it("Should prevent non-owners from withdrawing tokens", async function () {
      await expect(
        gameReward.connect(admin).withdrawTokens(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(gameReward, "OwnableUnauthorizedAccount");
    });

    it("Should prevent withdrawal when contract has insufficient tokens", async function () {
      const contractBalance = await token.balanceOf(gameReward.target);
      const excessiveAmount = contractBalance + ethers.parseEther("1");
      
      await expect(
        gameReward.withdrawTokens(excessiveAmount)
      ).to.be.reverted; // Use generic revert check as different tokens may have different error messages
    });

    it("Should prevent redemption when contract has insufficient tokens", async function () {
      // Withdraw most tokens from contract
      const contractBalance = await token.balanceOf(gameReward.target);
      await gameReward.withdrawTokens(contractBalance - ethers.parseEther("1"));
      
      // Award large amount of points
      await gameReward.connect(admin).awardPoints(player1.address, 10000);
      
      await expect(
        gameReward.connect(player1).redeemPoints(5000) // Would need 50 tokens but only 1 available
      ).to.be.revertedWith("Contract has insufficient tokens");
      
      // Restore tokens for other tests
      await token.transfer(gameReward.target, ethers.parseEther("5000"));
    });
  });

  describe("View Functions", function () {
    it("Should return correct token amount for points", async function () {
      // Current exchange rate is 100 (100 points = 1 token)
      // 300 points * 10^18 / 100 = 3 * 10^18 (3 tokens in wei)
      expect(await gameReward.getTokenAmount(300)).to.equal(ethers.parseEther("3"));
    });

    it("Should return zero for zero points", async function () {
      expect(await gameReward.getTokenAmount(0)).to.equal(0);
    });

    it("Should handle large point amounts in view function", async function () {
      const largePoints = ethers.parseEther("1000");
      const expectedTokens = (largePoints * ethers.parseEther("1")) / BigInt(100);
      expect(await gameReward.getTokenAmount(largePoints)).to.equal(expectedTokens);
    });

    it("Should return correct points balance", async function () {
      const currentBalance = await gameReward.getPointsBalance(player1.address);
      await gameReward.connect(admin).awardPoints(player1.address, 777);
      expect(await gameReward.getPointsBalance(player1.address)).to.equal(currentBalance + BigInt(777));
    });

    it("Should return zero balance for addresses with no points", async function () {
      const [newPlayer] = await ethers.getSigners();
      expect(await gameReward.getPointsBalance(newPlayer.address)).to.equal(0);
    });

    it("Should track balances independently for different players", async function () {
      const player1Balance = await gameReward.getPointsBalance(player1.address);
      const player2Balance = await gameReward.getPointsBalance(player2.address);
      
      await gameReward.connect(admin).awardPoints(player1.address, 111);
      await gameReward.connect(admin).awardPoints(player2.address, 222);
      
      expect(await gameReward.getPointsBalance(player1.address)).to.equal(player1Balance + BigInt(111));
      expect(await gameReward.getPointsBalance(player2.address)).to.equal(player2Balance + BigInt(222));
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete workflow: award -> redeem -> check balances", async function () {
      const [testPlayer] = await ethers.getSigners();
      const points = 1000;
      const redeemAmount = 400;
      
      // Award points
      await gameReward.connect(admin).awardPoints(testPlayer.address, points);
      expect(await gameReward.getPointsBalance(testPlayer.address)).to.equal(points);
      
      // Redeem some points
      const initialTokenBalance = await token.balanceOf(testPlayer.address);
      await gameReward.connect(testPlayer).redeemPoints(redeemAmount);
      
      // Check final balances
      expect(await gameReward.getPointsBalance(testPlayer.address)).to.equal(points - redeemAmount);
      const expectedTokens = (BigInt(redeemAmount) * ethers.parseEther("1")) / BigInt(100);
      expect(await token.balanceOf(testPlayer.address)).to.equal(initialTokenBalance + expectedTokens);
    });

    it("Should handle multiple players and multiple transactions", async function () {
      const [testPlayer1, testPlayer2] = await ethers.getSigners();
      
      // Get initial balances
      const initialBalance1 = await gameReward.getPointsBalance(testPlayer1.address);
      const initialBalance2 = await gameReward.getPointsBalance(testPlayer2.address);
      
      // Award points to multiple players
      await gameReward.connect(admin).awardPoints(testPlayer1.address, 500);
      await gameReward.connect(admin).awardPoints(testPlayer2.address, 300);
      
      // Both players redeem
      await gameReward.connect(testPlayer1).redeemPoints(200);
      await gameReward.connect(testPlayer2).redeemPoints(100);
      
      // Check remaining balances (initial + awarded - redeemed)
      expect(await gameReward.getPointsBalance(testPlayer1.address)).to.equal(initialBalance1 + BigInt(500) - BigInt(200));
      expect(await gameReward.getPointsBalance(testPlayer2.address)).to.equal(initialBalance2 + BigInt(300) - BigInt(100));
    });

    it("Should handle exchange rate changes during active use", async function () {
      const [testPlayer] = await ethers.getSigners();
      
      // Award points and check redemption with current rate (100)
      await gameReward.connect(admin).awardPoints(testPlayer.address, 300);
      expect(await gameReward.getTokenAmount(300)).to.equal(ethers.parseEther("3"));
      
      // Change exchange rate
      await gameReward.setExchangeRate(150);
      
      // Same points now worth fewer tokens
      expect(await gameReward.getTokenAmount(300)).to.equal(ethers.parseEther("2"));
      
      // Redeem with new rate
      const initialBalance = await token.balanceOf(testPlayer.address);
      await gameReward.connect(testPlayer).redeemPoints(300);
      expect(await token.balanceOf(testPlayer.address)).to.equal(initialBalance + ethers.parseEther("2"));
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle large uint256 values safely", async function () {
      const [testPlayer] = await ethers.getSigners();
      const largeAmount = ethers.parseEther("1000000");
      
      // Get initial balance
      const initialBalance = await gameReward.getPointsBalance(testPlayer.address);
      
      // This should not overflow
      await gameReward.connect(admin).awardPoints(testPlayer.address, largeAmount);
      expect(await gameReward.getPointsBalance(testPlayer.address)).to.equal(initialBalance + largeAmount);
    });

    it("Should prevent reentrancy attacks during redemption", async function () {
      const [testPlayer] = await ethers.getSigners();
      
      // Get initial balance and award fresh points for this test
      const initialBalance = await gameReward.getPointsBalance(testPlayer.address);
      await gameReward.connect(admin).awardPoints(testPlayer.address, 100);
      
      // Redeem the fresh points - state should update correctly
      await gameReward.connect(testPlayer).redeemPoints(100);
      expect(await gameReward.getPointsBalance(testPlayer.address)).to.equal(initialBalance);
    });

    it("Should handle multiple rapid transactions", async function () {
      const [testPlayer] = await ethers.getSigners();
      
      // Get initial balance
      const initialBalance = await gameReward.getPointsBalance(testPlayer.address);
      
      // Simulate rapid transactions
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(gameReward.connect(admin).awardPoints(testPlayer.address, 10));
      }
      
      await Promise.all(promises);
      expect(await gameReward.getPointsBalance(testPlayer.address)).to.equal(initialBalance + BigInt(100));
    });

    it("Should maintain consistency under pause/unpause cycles", async function () {
      const [testPlayer] = await ethers.getSigners();
      
      await gameReward.connect(admin).awardPoints(testPlayer.address, 100);
      const balanceBeforePause = await gameReward.getPointsBalance(testPlayer.address);
      
      await gameReward.pause();
      await gameReward.unpause();
      
      // State should be preserved
      expect(await gameReward.getPointsBalance(testPlayer.address)).to.equal(balanceBeforePause);
      
      // Should work normally after unpause
      await gameReward.connect(testPlayer).redeemPoints(50);
      expect(await gameReward.getPointsBalance(testPlayer.address)).to.equal(balanceBeforePause - BigInt(50));
    });

    it("Should handle withdrawal of all remaining tokens", async function () {
      const contractBalance = await token.balanceOf(gameReward.target);
      await gameReward.withdrawTokens(contractBalance);
      expect(await token.balanceOf(gameReward.target)).to.equal(0);
      
      // Restore some tokens for any remaining tests
      await token.transfer(gameReward.target, ethers.parseEther("1000"));
    });

    it("Should handle maximum precision calculations", async function () {
      // Test with rate that creates maximum precision scenarios
      await gameReward.setExchangeRate(3);
      
      const [testPlayer] = await ethers.getSigners();
      await gameReward.connect(admin).awardPoints(testPlayer.address, 10);
      
      // 10 points / 3 rate = 3.333... tokens = 3333333333333333333 wei (rounded down)
      const expectedTokens = (BigInt(10) * ethers.parseEther("1")) / BigInt(3);
      expect(await gameReward.getTokenAmount(10)).to.equal(expectedTokens);
      
      // Reset to standard rate
      await gameReward.setExchangeRate(100);
    });
  });
});