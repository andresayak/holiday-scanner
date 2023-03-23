// SPDX-License-Identifier: MIT
pragma solidity =0.6.6;

import "@uniswap/v2-periphery/contracts/UniswapV2Router01.sol";

contract SwapRouter01 is UniswapV2Router01 {
    constructor(address _factory, address _WETH) UniswapV2Router01(_factory, _WETH) public{}

    function getReservers(
        address tokenA,
        address tokenB
    )
        public view
        returns (uint, uint)
    {
        (uint reserveA, uint reserveB) = UniswapV2Library.getReserves(factory, tokenA, tokenB);
        return (reserveA, reserveB);
    }
}
