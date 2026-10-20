// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SehatEscrow} from "../src/SehatEscrow.sol";

/// Recipient that refuses BOT.
contract Rejecter {
    receive() external payable {
        revert("no");
    }
}

/// Programme owner that is also the recipient and tries to re-enter on receipt.
contract ReentrantOwner {
    SehatEscrow public escrow;
    uint256 public id;
    bool public attempted;

    constructor(SehatEscrow e) {
        escrow = e;
    }

    function setUp() external payable {
        id = escrow.register{value: msg.value}(bytes32("meta"), "ipfs://m", 7 days);
    }

    function release(bytes32 ref, uint256 amount) external {
        escrow.releaseReward(id, ref, payable(address(this)), amount);
    }

    receive() external payable {
        if (!attempted) {
            attempted = true;
            // Second payout from inside the first one's transfer: must be refused.
            escrow.releaseReward(id, keccak256("other"), payable(address(this)), msg.value);
        }
    }
}

contract SehatEscrowTest is Test {
    SehatEscrow escrow;

    address guardian = makeAddr("guardian");
    address owner = makeAddr("owner");
    address researcher = makeAddr("researcher");
    address stranger = makeAddr("stranger");

    bytes32 constant META = keccak256("programme metadata v1");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 constant REF = keccak256(abi.encode("SHT-0157", bytes32("salt")));
    uint32 constant WINDOW = 30 days;

    event Funded(uint256 indexed programmeId, address indexed from, uint256 amount, uint256 balance);
    event RewardReleased(
        uint256 indexed programmeId, bytes32 indexed reportRef, address indexed recipient, uint256 amount, uint256 balance
    );
    event ClosingStarted(uint256 indexed programmeId, uint64 closesAt);
    event UnusedWithdrawn(uint256 indexed programmeId, address indexed to, uint256 amount);

    function setUp() public {
        escrow = new SehatEscrow(guardian);
        vm.deal(owner, 1_000_000 ether);
        vm.deal(stranger, 1_000 ether);
    }

    function _register(uint256 value) internal returns (uint256 id) {
        vm.prank(owner);
        id = escrow.register{value: value}(META, "ipfs://meta", WINDOW);
    }

    // ------------------------------------------------------------ deployment

    function test_constructor_rejectsZeroGuardian() public {
        vm.expectRevert(SehatEscrow.ZeroAddress.selector);
        new SehatEscrow(address(0));
    }

    function test_plainTransferToContractReverts() public {
        vm.prank(stranger);
        (bool ok,) = address(escrow).call{value: 1 ether}("");
        assertFalse(ok);
    }

    // ------------------------------------------------------------ register

    function test_register_setsOwnerStatusAndWindow() public {
        uint256 id = _register(0);
        SehatEscrow.Programme memory p = escrow.getProgramme(id);
        assertEq(id, 1);
        assertEq(p.owner, owner);
        assertEq(uint8(p.status), uint8(SehatEscrow.Status.Active));
        assertEq(p.closingWindow, WINDOW);
        assertEq(p.metadataHash, META);
        assertEq(p.balance, 0);
    }

    function test_register_withValueFundsEscrow() public {
        vm.expectEmit(true, true, false, true);
        emit Funded(1, owner, 75_000 ether, 75_000 ether);
        uint256 id = _register(75_000 ether);
        assertEq(escrow.balanceOf(id), 75_000 ether);
        assertEq(escrow.getProgramme(id).totalFunded, 75_000 ether);
        assertEq(address(escrow).balance, 75_000 ether);
    }

    function test_register_rejectsClosingWindowOutOfRange() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.ClosingWindowOutOfRange.selector, uint32(7 days - 1)));
        escrow.register(META, "", 7 days - 1);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.ClosingWindowOutOfRange.selector, uint32(365 days + 1)));
        escrow.register(META, "", 365 days + 1);
        vm.stopPrank();
    }

    function test_register_idsIncrement() public {
        assertEq(_register(0), 1);
        assertEq(_register(0), 2);
        assertEq(escrow.programmeCount(), 2);
    }

    // ------------------------------------------------------------ fund

    function test_fund_addsToBalance() public {
        uint256 id = _register(60_000 ether);
        vm.prank(owner);
        escrow.fund{value: 40_000 ether}(id);
        assertEq(escrow.balanceOf(id), 100_000 ether);
        assertEq(escrow.getProgramme(id).totalFunded, 100_000 ether);
    }

    function test_fund_onlyOwner() public {
        uint256 id = _register(0);
        vm.prank(stranger);
        vm.expectRevert(SehatEscrow.NotOwner.selector);
        escrow.fund{value: 1 ether}(id);
    }

    function test_fund_rejectsZero() public {
        uint256 id = _register(0);
        vm.prank(owner);
        vm.expectRevert(SehatEscrow.ZeroAmount.selector);
        escrow.fund(id);
    }

    function test_fund_unknownProgramme() public {
        vm.prank(owner);
        vm.expectRevert(SehatEscrow.UnknownProgramme.selector);
        escrow.fund{value: 1 ether}(42);
    }

    function test_fund_allowedWhilePaused() public {
        uint256 id = _register(0);
        vm.startPrank(owner);
        escrow.setPaused(id, true);
        escrow.fund{value: 1 ether}(id);
        vm.stopPrank();
        assertEq(escrow.balanceOf(id), 1 ether);
    }

    function test_fund_rejectedWhileClosing() public {
        uint256 id = _register(0);
        vm.startPrank(owner);
        escrow.startClosing(id);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.WrongStatus.selector, SehatEscrow.Status.Closing));
        escrow.fund{value: 1 ether}(id);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ release

    function test_release_paysResearcher() public {
        uint256 id = _register(75_000 ether);
        vm.expectEmit(true, true, true, true);
        emit RewardReleased(id, REF, researcher, 30_000 ether, 45_000 ether);
        vm.prank(owner);
        escrow.releaseReward(id, REF, payable(researcher), 30_000 ether);

        assertEq(researcher.balance, 30_000 ether);
        assertEq(escrow.balanceOf(id), 45_000 ether);
        assertEq(escrow.getProgramme(id).totalPaid, 30_000 ether);
        assertTrue(escrow.isPaid(id, REF));
        assertEq(address(escrow).balance, 45_000 ether);
    }

    function test_release_refusesSecondPaymentForSameRef() public {
        uint256 id = _register(75_000 ether);
        vm.startPrank(owner);
        escrow.releaseReward(id, REF, payable(researcher), 1_000 ether);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.AlreadyPaid.selector, REF));
        escrow.releaseReward(id, REF, payable(researcher), 1_000 ether);
        // A different recipient or amount does not get around it either.
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.AlreadyPaid.selector, REF));
        escrow.releaseReward(id, REF, payable(stranger), 5 ether);
        vm.stopPrank();
        assertEq(researcher.balance, 1_000 ether);
    }

    function test_release_sameRefInAnotherProgrammeIsIndependent() public {
        uint256 a = _register(10 ether);
        uint256 b = _register(10 ether);
        vm.startPrank(owner);
        escrow.releaseReward(a, REF, payable(researcher), 1 ether);
        escrow.releaseReward(b, REF, payable(researcher), 1 ether);
        vm.stopPrank();
        assertEq(researcher.balance, 2 ether);
    }

    function test_release_cannotExceedBalance() public {
        uint256 id = _register(10 ether);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.InsufficientEscrow.selector, 10 ether, 10 ether + 1));
        escrow.releaseReward(id, REF, payable(researcher), 10 ether + 1);
    }

    function test_release_cannotSpendAnotherProgrammesEscrow() public {
        uint256 rich = _register(100 ether);
        uint256 poor = _register(1 ether);
        assertEq(rich, 1);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.InsufficientEscrow.selector, 1 ether, 50 ether));
        escrow.releaseReward(poor, REF, payable(researcher), 50 ether);
    }

    function test_release_onlyOwner() public {
        uint256 id = _register(10 ether);
        vm.prank(stranger);
        vm.expectRevert(SehatEscrow.NotOwner.selector);
        escrow.releaseReward(id, REF, payable(stranger), 1 ether);
    }

    function test_release_guardianCannotRelease() public {
        uint256 id = _register(10 ether);
        vm.prank(guardian);
        vm.expectRevert(SehatEscrow.NotOwner.selector);
        escrow.releaseReward(id, REF, payable(guardian), 1 ether);
    }

    function test_release_rejectsZeroRecipientZeroAmountZeroRef() public {
        uint256 id = _register(10 ether);
        vm.startPrank(owner);
        vm.expectRevert(SehatEscrow.InvalidRecipient.selector);
        escrow.releaseReward(id, REF, payable(address(0)), 1 ether);
        vm.expectRevert(SehatEscrow.InvalidRecipient.selector);
        escrow.releaseReward(id, REF, payable(address(escrow)), 1 ether);
        vm.expectRevert(SehatEscrow.ZeroAmount.selector);
        escrow.releaseReward(id, REF, payable(researcher), 0);
        vm.expectRevert(SehatEscrow.InvalidReportRef.selector);
        escrow.releaseReward(id, bytes32(0), payable(researcher), 1 ether);
        vm.stopPrank();
    }

    function test_release_allowedWhileOwnerPausedAndClosing() public {
        uint256 id = _register(10 ether);
        vm.startPrank(owner);
        escrow.setPaused(id, true);
        escrow.releaseReward(id, keccak256("a"), payable(researcher), 1 ether);
        escrow.startClosing(id);
        escrow.releaseReward(id, keccak256("b"), payable(researcher), 1 ether);
        vm.warp(block.timestamp + WINDOW + 1); // still Closing until withdrawn
        escrow.releaseReward(id, keccak256("c"), payable(researcher), 1 ether);
        vm.stopPrank();
        assertEq(researcher.balance, 3 ether);
    }

    function test_release_failedTransferLeavesRefUnpaid() public {
        uint256 id = _register(10 ether);
        Rejecter r = new Rejecter();
        vm.prank(owner);
        vm.expectRevert(SehatEscrow.TransferFailed.selector);
        escrow.releaseReward(id, REF, payable(address(r)), 1 ether);
        assertFalse(escrow.isPaid(id, REF));
        assertEq(escrow.balanceOf(id), 10 ether);
    }

    function test_release_reentrancyIsRefused() public {
        ReentrantOwner attacker = new ReentrantOwner(escrow);
        vm.deal(address(attacker), 0);
        attacker.setUp{value: 10 ether}();
        uint256 id = attacker.id();
        // The nested release reverts with Reentrancy, which makes the outer transfer fail.
        vm.expectRevert(SehatEscrow.TransferFailed.selector);
        attacker.release(REF, 4 ether);
        assertEq(escrow.balanceOf(id), 10 ether);
        assertFalse(escrow.isPaid(id, REF));
        assertEq(address(attacker).balance, 0);
    }

    // ------------------------------------------------------------ status

    function test_setPaused_togglesAndValidates() public {
        uint256 id = _register(0);
        vm.startPrank(owner);
        escrow.setPaused(id, true);
        assertEq(uint8(escrow.getProgramme(id).status), uint8(SehatEscrow.Status.Paused));
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.WrongStatus.selector, SehatEscrow.Status.Paused));
        escrow.setPaused(id, true);
        escrow.setPaused(id, false);
        assertEq(uint8(escrow.getProgramme(id).status), uint8(SehatEscrow.Status.Active));
        vm.stopPrank();
    }

    function test_setPaused_onlyOwner() public {
        uint256 id = _register(0);
        vm.prank(stranger);
        vm.expectRevert(SehatEscrow.NotOwner.selector);
        escrow.setPaused(id, true);
    }

    // ------------------------------------------------------------ closing and withdrawal

    function test_closing_fullLifecycle() public {
        uint256 id = _register(100 ether);
        vm.startPrank(owner);
        escrow.releaseReward(id, REF, payable(researcher), 25 ether);

        uint64 closesAt = uint64(block.timestamp) + WINDOW;
        vm.expectEmit(true, false, false, true);
        emit ClosingStarted(id, closesAt);
        escrow.startClosing(id);

        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.ClosingWindowNotOver.selector, closesAt));
        escrow.withdrawUnused(id, payable(owner));

        vm.warp(closesAt);
        uint256 before = owner.balance;
        vm.expectEmit(true, true, false, true);
        emit UnusedWithdrawn(id, owner, 75 ether);
        escrow.withdrawUnused(id, payable(owner));
        vm.stopPrank();

        assertEq(owner.balance - before, 75 ether);
        SehatEscrow.Programme memory p = escrow.getProgramme(id);
        assertEq(uint8(p.status), uint8(SehatEscrow.Status.Closed));
        assertEq(p.balance, 0);
        assertEq(p.totalPaid, 25 ether); // history kept
        assertTrue(escrow.isPaid(id, REF));
        assertEq(address(escrow).balance, 0);
    }

    function test_closing_isIrreversible() public {
        uint256 id = _register(0);
        vm.startPrank(owner);
        escrow.startClosing(id);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.WrongStatus.selector, SehatEscrow.Status.Closing));
        escrow.setPaused(id, false);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.WrongStatus.selector, SehatEscrow.Status.Closing));
        escrow.startClosing(id);
        vm.stopPrank();
    }

    function test_withdraw_notBeforeClosingStarts() public {
        uint256 id = _register(10 ether);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.WrongStatus.selector, SehatEscrow.Status.Active));
        escrow.withdrawUnused(id, payable(owner));
    }

    function test_withdraw_onlyOwnerAndOnce() public {
        uint256 id = _register(10 ether);
        vm.prank(owner);
        escrow.startClosing(id);
        vm.warp(block.timestamp + WINDOW);

        vm.prank(stranger);
        vm.expectRevert(SehatEscrow.NotOwner.selector);
        escrow.withdrawUnused(id, payable(stranger));

        vm.startPrank(owner);
        escrow.withdrawUnused(id, payable(owner));
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.WrongStatus.selector, SehatEscrow.Status.Closed));
        escrow.withdrawUnused(id, payable(owner));
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.WrongStatus.selector, SehatEscrow.Status.Closed));
        escrow.releaseReward(id, REF, payable(researcher), 1);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.WrongStatus.selector, SehatEscrow.Status.Closed));
        escrow.updateMetadata(id, META, "");
        vm.stopPrank();
    }

    function test_withdraw_rejectsZeroRecipient() public {
        uint256 id = _register(10 ether);
        vm.startPrank(owner);
        escrow.startClosing(id);
        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(SehatEscrow.InvalidRecipient.selector);
        escrow.withdrawUnused(id, payable(address(0)));
        vm.stopPrank();
    }

    function test_withdraw_emptyEscrowStillCloses() public {
        uint256 id = _register(0);
        vm.startPrank(owner);
        escrow.startClosing(id);
        vm.warp(block.timestamp + WINDOW);
        escrow.withdrawUnused(id, payable(owner));
        vm.stopPrank();
        assertEq(uint8(escrow.getProgramme(id).status), uint8(SehatEscrow.Status.Closed));
    }

    // ------------------------------------------------------------ ownership

    function test_ownership_twoStep() public {
        uint256 id = _register(10 ether);
        address next = makeAddr("next");
        vm.prank(owner);
        escrow.transferProgrammeOwnership(id, next);
        assertEq(escrow.getProgramme(id).owner, owner); // not yet

        vm.prank(stranger);
        vm.expectRevert(SehatEscrow.NotPendingOwner.selector);
        escrow.acceptProgrammeOwnership(id);

        vm.prank(next);
        escrow.acceptProgrammeOwnership(id);
        assertEq(escrow.getProgramme(id).owner, next);

        vm.prank(owner);
        vm.expectRevert(SehatEscrow.NotOwner.selector);
        escrow.releaseReward(id, REF, payable(owner), 1 ether);
    }

    function test_ownership_cannotAcceptWithoutOffer() public {
        uint256 id = _register(0);
        vm.prank(address(0));
        vm.expectRevert(SehatEscrow.NotPendingOwner.selector);
        escrow.acceptProgrammeOwnership(id);
    }

    // ------------------------------------------------------------ guardian

    function test_guardianPause_blocksMoneyMovementThenExpires() public {
        uint256 id = _register(10 ether);
        vm.prank(guardian);
        escrow.guardianPause(1 days);
        assertTrue(escrow.isGuardianPaused());
        uint64 until = escrow.pausedUntil();

        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.GuardianPauseActive.selector, until));
        escrow.releaseReward(id, REF, payable(researcher), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.GuardianPauseActive.selector, until));
        escrow.fund{value: 1 ether}(id);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.GuardianPauseActive.selector, until));
        escrow.register(META, "", WINDOW);
        // Owners keep control of their own programme status during a guardian pause.
        escrow.setPaused(id, true);

        vm.warp(until);
        assertFalse(escrow.isGuardianPaused());
        escrow.releaseReward(id, REF, payable(researcher), 1 ether);
        vm.stopPrank();
        assertEq(researcher.balance, 1 ether);
    }

    function test_guardianPause_boundsAndRole() public {
        vm.prank(stranger);
        vm.expectRevert(SehatEscrow.NotGuardian.selector);
        escrow.guardianPause(1 days);

        vm.startPrank(guardian);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.PauseTooLong.selector, uint64(7 days + 1)));
        escrow.guardianPause(7 days + 1);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.PauseTooLong.selector, uint64(0)));
        escrow.guardianPause(0);
        escrow.guardianPause(7 days);
        escrow.guardianUnpause();
        vm.stopPrank();
        assertFalse(escrow.isGuardianPaused());
    }

    function test_guardian_twoStepTransfer() public {
        address next = makeAddr("nextGuardian");
        vm.prank(guardian);
        escrow.transferGuardian(next);
        vm.prank(stranger);
        vm.expectRevert(SehatEscrow.NotPendingGuardian.selector);
        escrow.acceptGuardian();
        vm.prank(next);
        escrow.acceptGuardian();
        assertEq(escrow.guardian(), next);
        assertEq(escrow.pendingGuardian(), address(0));
    }

    function test_guardian_cannotTouchProgrammes() public {
        uint256 id = _register(10 ether);
        vm.startPrank(guardian);
        vm.expectRevert(SehatEscrow.NotOwner.selector);
        escrow.startClosing(id);
        vm.expectRevert(SehatEscrow.NotOwner.selector);
        escrow.withdrawUnused(id, payable(guardian));
        vm.expectRevert(SehatEscrow.NotOwner.selector);
        escrow.transferProgrammeOwnership(id, guardian);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ remaining branches

    event MetadataUpdated(uint256 indexed programmeId, bytes32 metadataHash, string metadataURI);

    function test_updateMetadata_ownerOnly() public {
        uint256 id = _register(0);
        bytes32 next = keccak256("v2");
        vm.expectEmit(true, false, false, true);
        emit MetadataUpdated(id, next, "ipfs://v2");
        vm.prank(owner);
        escrow.updateMetadata(id, next, "ipfs://v2");
        assertEq(escrow.getProgramme(id).metadataHash, next);
        vm.prank(stranger);
        vm.expectRevert(SehatEscrow.NotOwner.selector);
        escrow.updateMetadata(id, META, "");
    }

    function test_setPaused_resumeWhenActiveReverts() public {
        uint256 id = _register(0);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SehatEscrow.WrongStatus.selector, SehatEscrow.Status.Active));
        escrow.setPaused(id, false);
    }

    function test_withdraw_rejectingRecipientRevertsAndKeepsFunds() public {
        uint256 id = _register(10 ether);
        Rejecter r = new Rejecter();
        vm.startPrank(owner);
        escrow.startClosing(id);
        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(SehatEscrow.TransferFailed.selector);
        escrow.withdrawUnused(id, payable(address(r)));
        vm.expectRevert(SehatEscrow.InvalidRecipient.selector);
        escrow.withdrawUnused(id, payable(address(escrow)));
        vm.stopPrank();
        assertEq(escrow.balanceOf(id), 10 ether);
        assertEq(uint8(escrow.getProgramme(id).status), uint8(SehatEscrow.Status.Closing));
    }

    function test_ownership_unknownProgramme() public {
        vm.prank(stranger);
        vm.expectRevert(SehatEscrow.UnknownProgramme.selector);
        escrow.acceptProgrammeOwnership(99);
        vm.prank(stranger);
        vm.expectRevert(SehatEscrow.UnknownProgramme.selector);
        escrow.transferProgrammeOwnership(99, stranger);
    }

    function test_guardian_onlyGuardianManagesRole() public {
        vm.startPrank(stranger);
        vm.expectRevert(SehatEscrow.NotGuardian.selector);
        escrow.guardianUnpause();
        vm.expectRevert(SehatEscrow.NotGuardian.selector);
        escrow.transferGuardian(stranger);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_release_neverExceedsBalance(uint96 funded, uint96 amount) public {
        funded = uint96(bound(funded, 1, owner.balance));
        uint256 id = _register(funded);
        vm.prank(owner);
        if (amount == 0) {
            vm.expectRevert(SehatEscrow.ZeroAmount.selector);
        } else if (amount > funded) {
            vm.expectRevert(abi.encodeWithSelector(SehatEscrow.InsufficientEscrow.selector, uint256(funded), uint256(amount)));
        }
        escrow.releaseReward(id, REF, payable(researcher), amount);
        if (amount > 0 && amount <= funded) {
            assertEq(escrow.balanceOf(id), uint256(funded) - amount);
            assertEq(researcher.balance, amount);
        }
    }

    function testFuzz_accountingAddsUp(uint64 a, uint64 b, uint64 pay) public {
        vm.assume(a > 0 && b > 0);
        uint256 id = _register(a);
        vm.prank(owner);
        escrow.fund{value: b}(id);
        uint256 total = uint256(a) + b;
        pay = uint64(bound(pay, 1, total));
        vm.prank(owner);
        escrow.releaseReward(id, REF, payable(researcher), pay);
        SehatEscrow.Programme memory p = escrow.getProgramme(id);
        assertEq(p.totalFunded, total);
        assertEq(p.totalFunded - p.totalPaid, p.balance);
        assertEq(address(escrow).balance, p.balance);
    }
}
