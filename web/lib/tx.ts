// Write access to the SehatEscrow contract. Every call is simulated first (so contract refusals show
// as plain words before the wallet prompts), sent, and reported as done only after a successful receipt.

import {
  BaseError,
  ContractFunctionRevertedError,
  createWalletClient,
  custom,
  decodeEventLog,
  parseEther,
  type Hex,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { ESCROW_ABI } from "./escrow-abi";
import { publicClient } from "./chain";
import { ACTIVE_NETWORK, ESCROW_ADDRESS, VIEM_CHAIN } from "./config";

export type Sender = { wallet: WalletClient; account: Hex };

/** A sender backed by the browser wallet (EIP-1193). */
export function browserSender(account: string): Sender {
  if (typeof window === "undefined" || !window.ethereum) throw new Error("No browser wallet found.");
  const wallet = createWalletClient({ chain: VIEM_CHAIN, transport: custom(window.ethereum) });
  return { wallet, account: account as Hex };
}

const MESSAGES: Record<string, string> = {
  NotOwner: "Only the programme owner's wallet can do this.",
  NotPendingOwner: "This wallet has not been offered ownership of the programme.",
  UnknownProgramme: "There is no programme with this ID on the escrow contract.",
  WrongStatus: "The programme's status does not allow this action.",
  GuardianPauseActive: "The platform guardian has paused escrow actions. Try again after the pause ends.",
  ZeroAmount: "Enter an amount above zero.",
  InvalidRecipient: "The recipient address is not valid.",
  InvalidReportRef: "The report reference is empty.",
  InsufficientEscrow: "Escrow does not hold enough BOT for this payout.",
  AlreadyPaid: "This report has already been paid. The contract pays each report once.",
  ClosingWindowOutOfRange: "The closing window must be between 7 and 365 days.",
  ClosingWindowNotOver: "The closing window has not ended yet.",
  TransferFailed: "The recipient address refused the BOT transfer.",
  Reentrancy: "The call was refused by the reentrancy guard.",
};

/** Turns a viem or wallet error into one plain sentence. */
export function explainError(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      return MESSAGES[revert.data.errorName] ?? `The contract refused: ${revert.data.errorName}.`;
    }
    if (/User (rejected|denied)/i.test(e.message) || (e as { code?: number }).code === 4001) return "Rejected in the wallet.";
    if (/insufficient funds/i.test(e.message)) return "The wallet does not hold enough BOT for this transaction and its gas.";
    return e.shortMessage || "The transaction failed.";
  }
  if ((e as { code?: number })?.code === 4001) return "Rejected in the wallet.";
  return e instanceof Error ? e.message : "The transaction failed.";
}

type Fn = "register" | "fund" | "releaseReward" | "setPaused" | "startClosing" | "withdrawUnused";

async function send(
  s: Sender,
  functionName: Fn,
  args: readonly unknown[],
  value: bigint | undefined,
  onHash?: (hash: Hex) => void,
): Promise<TransactionReceipt> {
  if (!ESCROW_ADDRESS) throw new Error("The escrow contract is not configured.");
  const walletChain = await s.wallet.getChainId();
  if (walletChain !== ACTIVE_NETWORK.chainId) throw new Error(`Switch the wallet to ${ACTIVE_NETWORK.name} (chain ${ACTIVE_NETWORK.chainId}).`);

  const { request } = await publicClient.simulateContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName,
    // viem checks args against the ABI at runtime; the union of functions defeats static narrowing here.
    args: args as never,
    value: value as undefined, // payable only for register and fund; viem validates at runtime
    account: s.account,
  });
  const hash = await s.wallet.writeContract({ ...request, account: s.account, chain: VIEM_CHAIN });
  onHash?.(hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The transaction was mined but reverted.");
  return receipt;
}

export async function registerProgramme(
  s: Sender,
  metadataHash: Hex,
  metadataURI: string,
  closingWindowDays: number,
  onHash?: (h: Hex) => void,
): Promise<{ programmeId: number; receipt: TransactionReceipt }> {
  const receipt = await send(s, "register", [metadataHash, metadataURI, closingWindowDays * 86_400], undefined, onHash);
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: ESCROW_ABI, data: log.data, topics: log.topics });
      if (ev.eventName === "ProgrammeRegistered") return { programmeId: Number(ev.args.programmeId), receipt };
    } catch {
      /* not one of ours */
    }
  }
  throw new Error("Registered, but the programme ID was not found in the receipt.");
}

export const fundProgramme = (s: Sender, programmeId: number, amountBot: string, onHash?: (h: Hex) => void) =>
  send(s, "fund", [BigInt(programmeId)], parseEther(amountBot), onHash);

export const setProgrammePaused = (s: Sender, programmeId: number, paused: boolean, onHash?: (h: Hex) => void) =>
  send(s, "setPaused", [BigInt(programmeId), paused], undefined, onHash);

export const startClosing = (s: Sender, programmeId: number, onHash?: (h: Hex) => void) =>
  send(s, "startClosing", [BigInt(programmeId)], undefined, onHash);

export const withdrawUnused = (s: Sender, programmeId: number, to: Hex, onHash?: (h: Hex) => void) =>
  send(s, "withdrawUnused", [BigInt(programmeId), to], undefined, onHash);

/** Pay an agreed reward. `reportRef` is the salted digest issued by the reports service. */
export const releaseReward = (s: Sender, programmeId: number, reportRef: Hex, recipient: Hex, amountBot: string, onHash?: (h: Hex) => void) =>
  send(s, "releaseReward", [BigInt(programmeId), reportRef, recipient, parseEther(amountBot)], undefined, onHash);
