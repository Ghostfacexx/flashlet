// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/AaveV3.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract MultiPairFlashArbitrage {
    struct SwapData {
        address token0;
        address token1;
        address router0;
        address router1;
    }

    address public immutable POOL;
    mapping(address => bool) public whitelistedRouters;
    uint256 public immutable minProfit;
    address public owner;

    event DebugLog(
        uint256 flashAmount,
        uint256 premium,
        uint256 token0Before,
        uint256 token1AfterSwap1,
        uint256 token0AfterSwap2
    );

    event DebugCheck(
        uint256 totalOwed,
        uint256 scaledMinProfit,
        uint256 finalBalance
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor(address _addressProvider, address[] memory routerAddresses, uint256 _minProfit) {
        POOL = IPoolAddressesProvider(_addressProvider).getPool();
        for (uint256 i = 0; i < routerAddresses.length; i++) {
            whitelistedRouters[routerAddresses[i]] = true;
        }
        minProfit = _minProfit;
        owner = msg.sender;
    }

    function executeFlashArbitrage(
        address token0,
        address token1,
        address router0,
        address router1
    ) external {
        require(token0 != address(0) && token1 != address(0), "Invalid token addresses");
        require(router0 != address(0) && router1 != address(0), "Invalid router addresses");

        SwapData memory swap = SwapData({
            token0: token0,
            token1: token1,
            router0: router0,
            router1: router1
        });

        bytes memory data = abi.encode(swap);
        uint256 amount = 1000 * 10 ** IERC20Metadata(token0).decimals();
        requestFlashLoan(token0, amount, data);
    }

    function requestFlashLoan(address asset, uint256 amount, bytes memory params) internal {
        IPool(POOL).flashLoanSimple(address(this), asset, amount, params, 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender == POOL, "Only pool can call");
        require(initiator == address(this), "Only self initiated");

        SwapData memory swap = abi.decode(params, (SwapData));

        require(whitelistedRouters[swap.router0], "Router0 not whitelisted");
        require(whitelistedRouters[swap.router1], "Router1 not whitelisted");

        uint256 initialBalance = IERC20(swap.token0).balanceOf(address(this));

        IERC20(swap.token0).approve(swap.router0, amount);
        _swap(swap.router0, amount, swap.token0, swap.token1);

        uint256 intermediateBalance = IERC20(swap.token1).balanceOf(address(this));
        require(intermediateBalance > 0, "Swap1 returned 0");

        IERC20(swap.token1).approve(swap.router1, intermediateBalance);
        _swap(swap.router1, intermediateBalance, swap.token1, swap.token0);

        uint256 finalBalance = IERC20(swap.token0).balanceOf(address(this));
        require(finalBalance > 0, "Swap2 returned 0");

        uint256 totalOwed = amount + premium;
        uint8 tokenDecimals = IERC20Metadata(swap.token0).decimals();
        uint256 scaledMinProfit = minProfit / (10 ** (18 - tokenDecimals));

        emit DebugLog(amount, premium, initialBalance, intermediateBalance, finalBalance);
        emit DebugCheck(totalOwed, scaledMinProfit, finalBalance);

        require(finalBalance >= totalOwed, "Cannot repay loan");
        require(finalBalance >= totalOwed + scaledMinProfit, "Not profitable");

        IERC20(swap.token0).approve(POOL, totalOwed);
        return true;
    }

    function _swap(address router, uint256 amountIn, address tokenIn, address tokenOut) internal {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        (bool success, ) = router.call(
            abi.encodeWithSignature(
                "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
                amountIn,
                0,
                path,
                address(this),
                block.timestamp
            )
        );

        require(success, "Swap failed");
    }

    function withdrawToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No token balance");
        IERC20(token).transfer(owner, balance);
    }

    function withdrawNative() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function executeTriangleArbitrage(
        address token0,
        address token1,
        address token2,
        address router0,
        address router1,
        address router2
    ) external onlyOwner {
        uint256 amountIn = IERC20(token0).balanceOf(address(this));
        _swap(router0, amountIn, token0, token1);

        amountIn = IERC20(token1).balanceOf(address(this));
        _swap(router1, amountIn, token1, token2);

        amountIn = IERC20(token2).balanceOf(address(this));
        _swap(router2, amountIn, token2, token0);
    }

}
