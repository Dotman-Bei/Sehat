// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SehatEscrow} from "../src/SehatEscrow.sol";

/// Deploys SehatEscrow.
///
///   GUARDIAN=0x... forge script script/Deploy.s.sol --rpc-url bohr --account sehat-deployer --broadcast \
///     --verify --verifier blockscout --verifier-url https://scan.bohr.life/api/
///
/// Sign with an encrypted keystore (`cast wallet import sehat-deployer --interactive`).
/// Never put a private key in a file, an environment variable or the repository.
contract Deploy is Script {
    function run() external returns (SehatEscrow escrow) {
        address guardian = vm.envAddress("GUARDIAN");
        require(guardian != address(0), "GUARDIAN must be set");

        uint256 chainId = block.chainid;
        require(chainId == 968 || chainId == 677 || chainId == 31337, "unexpected chain: expected Bohr 968, BOT 677 or local");

        vm.startBroadcast();
        escrow = new SehatEscrow(guardian);
        vm.stopBroadcast();

        console.log("SehatEscrow deployed at", address(escrow));
        console.log("chain id", chainId);
        console.log("guardian", guardian);
    }
}
