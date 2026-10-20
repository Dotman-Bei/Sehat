// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SehatEscrow} from "../src/SehatEscrow.sol";

/// Drives random sequences of register / fund / release / pause / close / withdraw across several owners.
contract Handler is Test {
    SehatEscrow public escrow;
    address[] public owners;
    uint256[] public ids;
    mapping(uint256 => address) public ownerOf;

    uint256 public ghostFunded;
    uint256 public ghostPaid;
    uint256 public ghostWithdrawn;
    uint256 public ghostDoublePaySucceeded;

    constructor(SehatEscrow e) {
        escrow = e;
        for (uint256 i; i < 3; i++) {
            address o = makeAddr(string(abi.encode("owner", i)));
            vm.deal(o, type(uint96).max);
            owners.push(o);
        }
    }

    function register(uint256 ownerSeed, uint96 value) external {
        address o = owners[ownerSeed % owners.length];
        value = uint96(bound(value, 0, 1_000_000 ether));
        vm.prank(o);
        uint256 id = escrow.register{value: value}(bytes32(0), "", 7 days);
        ids.push(id);
        ownerOf[id] = o;
        ghostFunded += value;
    }

    function fund(uint256 idSeed, uint96 value) external {
        if (ids.length == 0) return;
        uint256 id = ids[idSeed % ids.length];
        value = uint96(bound(value, 1, 1_000_000 ether));
        vm.prank(ownerOf[id]);
        try escrow.fund{value: value}(id) {
            ghostFunded += value;
        } catch {}
    }

    function release(uint256 idSeed, uint256 refSeed, uint256 amount) external {
        if (ids.length == 0) return;
        uint256 id = ids[idSeed % ids.length];
        bytes32 ref = keccak256(abi.encode(refSeed % 20)); // small ref space forces repeats
        bool wasPaid = escrow.isPaid(id, ref);
        amount = bound(amount, 1, escrow.balanceOf(id) + 1 ether);
        vm.prank(ownerOf[id]);
        try escrow.releaseReward(id, ref, payable(address(0xBEEF)), amount) {
            ghostPaid += amount;
            if (wasPaid) ghostDoublePaySucceeded++;
        } catch {}
    }

    function pause(uint256 idSeed, bool paused) external {
        if (ids.length == 0) return;
        uint256 id = ids[idSeed % ids.length];
        vm.prank(ownerOf[id]);
        try escrow.setPaused(id, paused) {} catch {}
    }

    function close(uint256 idSeed) external {
        if (ids.length == 0) return;
        uint256 id = ids[idSeed % ids.length];
        vm.prank(ownerOf[id]);
        try escrow.startClosing(id) {} catch {}
    }

    function withdraw(uint256 idSeed, uint32 wait) external {
        if (ids.length == 0) return;
        uint256 id = ids[idSeed % ids.length];
        vm.warp(block.timestamp + bound(wait, 0, 10 days));
        uint256 bal = escrow.balanceOf(id);
        vm.prank(ownerOf[id]);
        try escrow.withdrawUnused(id, payable(address(0xCAFE))) {
            ghostWithdrawn += bal;
        } catch {}
    }

    function idsLength() external view returns (uint256) {
        return ids.length;
    }
}

contract SehatEscrowInvariantTest is Test {
    SehatEscrow escrow;
    Handler handler;

    function setUp() public {
        escrow = new SehatEscrow(makeAddr("guardian"));
        handler = new Handler(escrow);
        targetContract(address(handler));
    }

    /// Every wei the contract holds belongs to exactly one programme's balance.
    function invariant_contractBalanceEqualsSumOfProgrammeBalances() public view {
        uint256 sum;
        for (uint256 i; i < handler.idsLength(); i++) sum += escrow.balanceOf(handler.ids(i));
        assertEq(address(escrow).balance, sum);
    }

    /// Money in = money out + money held.
    function invariant_fundsConserved() public view {
        assertEq(handler.ghostFunded(), handler.ghostPaid() + handler.ghostWithdrawn() + address(escrow).balance);
    }

    /// For every programme: funded - paid - withdrawn = balance, and a closed programme holds nothing.
    function invariant_perProgrammeAccounting() public view {
        for (uint256 i; i < handler.idsLength(); i++) {
            SehatEscrow.Programme memory p = escrow.getProgramme(handler.ids(i));
            assertLe(p.totalPaid + p.balance, p.totalFunded);
            if (p.status == SehatEscrow.Status.Closed) assertEq(p.balance, 0);
        }
    }

    /// A report reference is never paid twice.
    function invariant_noDoublePayment() public view {
        assertEq(handler.ghostDoublePaySucceeded(), 0);
    }
}
