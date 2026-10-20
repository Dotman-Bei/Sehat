// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title SehatEscrow
/// @notice Escrow for Sehat bug-bounty programmes on BOT Chain, in native BOT.
///
/// What this contract guarantees, and nothing more:
///   - A programme's escrow can only leave through `releaseReward` (to a researcher) or
///     `withdrawUnused` (to the owner, after the programme's closing window has ended).
///   - Only the programme owner can release or withdraw. No other account, including the guardian,
///     can move a programme's funds.
///   - A reward never exceeds the programme's balance, and each report reference is paid at most once.
///
/// What it does NOT do: decide whether a report is valid, choose the severity or the amount, or force
/// an owner to pay. Those decisions are made off-chain by the programme owner (see the PRD trust model).
///
/// Privacy: report contents never touch this contract. `reportRef` must be a salted digest computed
/// off-chain, e.g. keccak256(abi.encode(reportId, secretSalt)), so it cannot be linked to a report by
/// guessing identifiers. Only the digest, the recipient and the amount appear in events.
contract SehatEscrow {
    // ------------------------------------------------------------------ types

    enum Status {
        None, // programme id not registered
        Active, // accepting reports (enforced off-chain), can be funded
        Paused, // owner paused new reports; funding and payouts continue
        Closing, // closing window running; payouts continue, no new funding
        Closed // unused funds withdrawn; nothing more can happen
    }

    struct Programme {
        address owner;
        Status status;
        uint32 closingWindow; // seconds, fixed at registration
        uint64 closesAt; // 0 until closing starts
        address pendingOwner;
        uint256 balance;
        uint256 totalFunded;
        uint256 totalPaid;
        bytes32 metadataHash;
    }

    // ------------------------------------------------------------------ constants

    uint32 public constant MIN_CLOSING_WINDOW = 7 days;
    uint32 public constant MAX_CLOSING_WINDOW = 365 days;
    /// @notice The longest single emergency pause. A pause always expires on its own.
    uint64 public constant MAX_GUARDIAN_PAUSE = 7 days;

    // ------------------------------------------------------------------ storage

    /// @notice Platform emergency role: can pause funding, registration, payouts and withdrawals
    ///         for at most MAX_GUARDIAN_PAUSE at a time. Cannot move funds or change any programme.
    address public guardian;
    address public pendingGuardian;
    uint64 public pausedUntil;

    uint256 public programmeCount;
    mapping(uint256 => Programme) private _programmes;
    /// @notice programmeId => reportRef => paid
    mapping(uint256 => mapping(bytes32 => bool)) public isPaid;

    uint256 private _lock = 1;

    // ------------------------------------------------------------------ events

    event ProgrammeRegistered(
        uint256 indexed programmeId, address indexed owner, bytes32 metadataHash, string metadataURI, uint32 closingWindow
    );
    event MetadataUpdated(uint256 indexed programmeId, bytes32 metadataHash, string metadataURI);
    event Funded(uint256 indexed programmeId, address indexed from, uint256 amount, uint256 balance);
    event RewardReleased(
        uint256 indexed programmeId, bytes32 indexed reportRef, address indexed recipient, uint256 amount, uint256 balance
    );
    event StatusChanged(uint256 indexed programmeId, Status status);
    event ClosingStarted(uint256 indexed programmeId, uint64 closesAt);
    event UnusedWithdrawn(uint256 indexed programmeId, address indexed to, uint256 amount);
    event OwnershipTransferStarted(uint256 indexed programmeId, address indexed from, address indexed to);
    event OwnershipTransferred(uint256 indexed programmeId, address indexed from, address indexed to);
    event GuardianPaused(uint64 until);
    event GuardianUnpaused();
    event GuardianTransferStarted(address indexed from, address indexed to);
    event GuardianTransferred(address indexed from, address indexed to);

    // ------------------------------------------------------------------ errors

    error NotOwner();
    error NotPendingOwner();
    error NotGuardian();
    error NotPendingGuardian();
    error UnknownProgramme();
    error WrongStatus(Status current);
    error GuardianPauseActive(uint64 until);
    error ZeroAddress();
    error ZeroAmount();
    error InvalidRecipient();
    error InvalidReportRef();
    error InsufficientEscrow(uint256 balance, uint256 requested);
    error AlreadyPaid(bytes32 reportRef);
    error ClosingWindowOutOfRange(uint32 window);
    error ClosingWindowNotOver(uint64 closesAt);
    error PauseTooLong(uint64 duration);
    error TransferFailed();
    error Reentrancy();

    // ------------------------------------------------------------------ modifiers

    modifier onlyProgrammeOwner(uint256 programmeId) {
        Programme storage p = _programmes[programmeId];
        if (p.status == Status.None) revert UnknownProgramme();
        if (msg.sender != p.owner) revert NotOwner();
        _;
    }

    modifier whenNotGuardianPaused() {
        if (block.timestamp < pausedUntil) revert GuardianPauseActive(pausedUntil);
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address guardian_) {
        if (guardian_ == address(0)) revert ZeroAddress();
        guardian = guardian_;
        emit GuardianTransferred(address(0), guardian_);
    }

    // ------------------------------------------------------------------ programme lifecycle

    /// @notice Register a programme owned by the caller. Any BOT sent funds its escrow in the same call.
    /// @param metadataHash Digest of the public programme metadata (scope, rules, tiers). No private data.
    /// @param metadataURI Where the public metadata can be fetched. Emitted, not stored.
    /// @param closingWindow Seconds that reports keep to be resolved and paid after closing starts.
    function register(bytes32 metadataHash, string calldata metadataURI, uint32 closingWindow)
        external
        payable
        whenNotGuardianPaused
        returns (uint256 programmeId)
    {
        if (closingWindow < MIN_CLOSING_WINDOW || closingWindow > MAX_CLOSING_WINDOW) {
            revert ClosingWindowOutOfRange(closingWindow);
        }
        programmeId = ++programmeCount;
        Programme storage p = _programmes[programmeId];
        p.owner = msg.sender;
        p.status = Status.Active;
        p.closingWindow = closingWindow;
        p.metadataHash = metadataHash;
        emit ProgrammeRegistered(programmeId, msg.sender, metadataHash, metadataURI, closingWindow);
        emit StatusChanged(programmeId, Status.Active);

        if (msg.value > 0) _fund(p, programmeId);
    }

    /// @notice Add BOT to a programme's escrow. Owner only, while Active or Paused.
    function fund(uint256 programmeId) external payable onlyProgrammeOwner(programmeId) whenNotGuardianPaused {
        Programme storage p = _programmes[programmeId];
        if (p.status != Status.Active && p.status != Status.Paused) revert WrongStatus(p.status);
        if (msg.value == 0) revert ZeroAmount();
        _fund(p, programmeId);
    }

    function _fund(Programme storage p, uint256 programmeId) private {
        p.balance += msg.value;
        p.totalFunded += msg.value;
        emit Funded(programmeId, msg.sender, msg.value, p.balance);
    }

    /// @notice Pay an agreed reward from escrow. Each reportRef can be paid once per programme.
    /// @dev Checks-effects-interactions: the reference is marked paid and the balance reduced before
    ///      the transfer, and the call is guarded against reentrancy. A recipient that rejects BOT makes
    ///      the whole call revert, leaving the reference unpaid.
    function releaseReward(uint256 programmeId, bytes32 reportRef, address payable recipient, uint256 amount)
        external
        onlyProgrammeOwner(programmeId)
        whenNotGuardianPaused
        nonReentrant
    {
        Programme storage p = _programmes[programmeId];
        if (p.status != Status.Active && p.status != Status.Paused && p.status != Status.Closing) {
            revert WrongStatus(p.status);
        }
        if (reportRef == bytes32(0)) revert InvalidReportRef();
        if (recipient == address(0) || recipient == address(this)) revert InvalidRecipient();
        if (amount == 0) revert ZeroAmount();
        if (amount > p.balance) revert InsufficientEscrow(p.balance, amount);
        if (isPaid[programmeId][reportRef]) revert AlreadyPaid(reportRef);

        isPaid[programmeId][reportRef] = true;
        p.balance -= amount;
        p.totalPaid += amount;
        emit RewardReleased(programmeId, reportRef, recipient, amount, p.balance);

        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Owner pauses or resumes new reports. Funding and payouts are unaffected.
    function setPaused(uint256 programmeId, bool paused) external onlyProgrammeOwner(programmeId) {
        Programme storage p = _programmes[programmeId];
        Status next = paused ? Status.Paused : Status.Active;
        Status expected = paused ? Status.Active : Status.Paused;
        if (p.status != expected) revert WrongStatus(p.status);
        p.status = next;
        emit StatusChanged(programmeId, next);
    }

    /// @notice Start the closing window. Irreversible. Payouts continue; new funding stops.
    function startClosing(uint256 programmeId) external onlyProgrammeOwner(programmeId) {
        Programme storage p = _programmes[programmeId];
        if (p.status != Status.Active && p.status != Status.Paused) revert WrongStatus(p.status);
        uint64 closesAt = uint64(block.timestamp) + p.closingWindow;
        p.status = Status.Closing;
        p.closesAt = closesAt;
        emit StatusChanged(programmeId, Status.Closing);
        emit ClosingStarted(programmeId, closesAt);
    }

    /// @notice After the closing window ends, return what is left in escrow to `to` and close the
    ///         programme for good. Payout history stays in the event log.
    function withdrawUnused(uint256 programmeId, address payable to)
        external
        onlyProgrammeOwner(programmeId)
        whenNotGuardianPaused
        nonReentrant
    {
        Programme storage p = _programmes[programmeId];
        if (p.status != Status.Closing) revert WrongStatus(p.status);
        if (block.timestamp < p.closesAt) revert ClosingWindowNotOver(p.closesAt);
        if (to == address(0) || to == address(this)) revert InvalidRecipient();

        uint256 amount = p.balance;
        p.balance = 0;
        p.status = Status.Closed;
        emit StatusChanged(programmeId, Status.Closed);
        emit UnusedWithdrawn(programmeId, to, amount);

        if (amount > 0) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice Point to new public metadata (scope or rules changed). Not allowed once Closed.
    function updateMetadata(uint256 programmeId, bytes32 metadataHash, string calldata metadataURI)
        external
        onlyProgrammeOwner(programmeId)
    {
        Programme storage p = _programmes[programmeId];
        if (p.status == Status.Closed) revert WrongStatus(p.status);
        p.metadataHash = metadataHash;
        emit MetadataUpdated(programmeId, metadataHash, metadataURI);
    }

    // ------------------------------------------------------------------ programme ownership (two-step)

    function transferProgrammeOwnership(uint256 programmeId, address newOwner) external onlyProgrammeOwner(programmeId) {
        _programmes[programmeId].pendingOwner = newOwner; // address(0) cancels
        emit OwnershipTransferStarted(programmeId, msg.sender, newOwner);
    }

    function acceptProgrammeOwnership(uint256 programmeId) external {
        Programme storage p = _programmes[programmeId];
        if (p.status == Status.None) revert UnknownProgramme();
        if (msg.sender != p.pendingOwner || msg.sender == address(0)) revert NotPendingOwner();
        address previous = p.owner;
        p.owner = msg.sender;
        p.pendingOwner = address(0);
        emit OwnershipTransferred(programmeId, previous, msg.sender);
    }

    // ------------------------------------------------------------------ guardian (emergency pause only)

    /// @notice Pause registration, funding, payouts and withdrawals for `duration` seconds
    ///         (at most MAX_GUARDIAN_PAUSE). Programme owners can still pause or close their programmes.
    function guardianPause(uint64 duration) external {
        if (msg.sender != guardian) revert NotGuardian();
        if (duration == 0 || duration > MAX_GUARDIAN_PAUSE) revert PauseTooLong(duration);
        pausedUntil = uint64(block.timestamp) + duration;
        emit GuardianPaused(pausedUntil);
    }

    function guardianUnpause() external {
        if (msg.sender != guardian) revert NotGuardian();
        pausedUntil = 0;
        emit GuardianUnpaused();
    }

    function transferGuardian(address newGuardian) external {
        if (msg.sender != guardian) revert NotGuardian();
        pendingGuardian = newGuardian;
        emit GuardianTransferStarted(msg.sender, newGuardian);
    }

    function acceptGuardian() external {
        if (msg.sender != pendingGuardian || msg.sender == address(0)) revert NotPendingGuardian();
        emit GuardianTransferred(guardian, msg.sender);
        guardian = msg.sender;
        pendingGuardian = address(0);
    }

    // ------------------------------------------------------------------ views

    function getProgramme(uint256 programmeId) external view returns (Programme memory) {
        return _programmes[programmeId];
    }

    function balanceOf(uint256 programmeId) external view returns (uint256) {
        return _programmes[programmeId].balance;
    }

    function isGuardianPaused() external view returns (bool) {
        return block.timestamp < pausedUntil;
    }

    // No receive or fallback: plain BOT transfers to the contract revert, so every wei held is
    // accounted to a programme. (BOT forced in by selfdestruct is never credited to anyone.)
}
