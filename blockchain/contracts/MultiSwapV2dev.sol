// SPDX-License-Identifier: MIT
pragma solidity =0.6.6;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import "hardhat/console.sol";

interface IERC20 {
    function balanceOf(address owner) external view returns (uint);
    function transfer(address to, uint value) external returns (bool);
}

library SafeMath {
    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, 'ds-math-add-overflow');
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, 'ds-math-sub-underflow');
    }

    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x, 'ds-math-mul-overflow');
    }
}

contract MultiSwapV2 {
    using SafeMath for uint;
    address public immutable owner;

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, 'c');
        _;
    }

    function swapExact(
        address[] calldata pairs,
        address[] calldata path,
        uint[] calldata amounts
    )
    external
    onlyOwner
    {
        assert(IERC20(path[0]).transfer(pairs[0], amounts[0]));
        _swap(amounts, pairs, path);
    }

    function swap(
        uint amountIn,
        address[] calldata pairs,
        address[] calldata path,
        uint[] calldata fee,
        uint[] calldata fee_scale
    )
    external
    onlyOwner
    {
        uint[] memory amounts = getAmountsOut(pairs, amountIn, path, fee, fee_scale);
        console.log('amount1', amounts[1]);
        console.log('amount2', amounts[2]);
        if(amounts[2]>=amountIn){
            uint[] storage amounts0;
            amounts0.push(amountIn);
            amounts0.push(amounts[1]);
            amounts0.push(amounts[2]);

            uint balanceBefore = IERC20(path[0]).balanceOf(address(this));

            assert(IERC20(path[0]).transfer(pairs[0], amountIn));
            _swap(amounts0, pairs, path);

            require(
                IERC20(path[0]).balanceOf(address(this)) >= balanceBefore,
                'b'
            );
        }
    }

    function _swap(uint[] memory amounts, address[] memory pairs, address[] memory path) internal {
        for (uint i; i < path.length - 1; i++) {
            (address token0,) = sortTokens(path[i], path[i + 1]);
            (uint amount0Out, uint amount1Out) = path[i] == token0 ? (uint(0), amounts[i+1]) : (uint(amounts[i+1]), uint(0));
            address to = i < path.length - 2 ? pairs[i + 1] : address(this);
            console.log('swap', pairs[i], amount0Out, amount1Out);
            IUniswapV2Pair(pairs[i]).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }

    function withdraw(
        address token,
        uint amount
    )
    external
    onlyOwner
    {
        assert(IERC20(token).transfer(msg.sender, amount));
    }

    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    function getAmountsOut(address[] memory pairs, uint amountIn, address[] memory path, uint[] memory fee, uint[] memory fee_scale)
    internal view returns (uint[] memory amounts) {
        require(path.length >= 2, 'd');
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        for (uint i; i < path.length - 1; i++) {
            (uint reserveIn, uint reserveOut) = getReserves(pairs[i], path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut, fee[i], fee_scale[i]);
        }
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut, uint fee, uint fee_scale) internal pure returns (uint amountOut) {
        require(amountIn > 0, 'e');
        require(reserveIn > 0 && reserveOut > 0, 'f');
        uint amountInWithFee = amountIn.mul(fee_scale.sub(fee));
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(fee_scale).add(amountInWithFee);
        amountOut = (numerator / denominator);
    }

    function getReserves(address pair, address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB) {
        (address token0,) = sortTokens(tokenA, tokenB);
        (uint reserve0, uint reserve1,) = IUniswapV2Pair(pair).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }
}
