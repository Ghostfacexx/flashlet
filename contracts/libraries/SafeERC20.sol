// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC20.sol";

library SafeERC20 {
    function safeApprove(IERC20 token, address to, uint256 value) internal {
        require(token.approve(to, value), "SafeERC20: Approve failed");
    }

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        require(token.transfer(to, value), "SafeERC20: Transfer failed");
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        require(token.transferFrom(from, to, value), "SafeERC20: TransferFrom failed");
    }
}
