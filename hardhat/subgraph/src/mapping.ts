import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  CandidateAdded,
  ElectionStateChanged,
  VoteCommitted,
  VoteRevealed,
} from "../../generated/Election/Election";
import {
  ElectionMeta,
  Candidate,
  VoteCommit,
  VoteReveal,
  ElectionPhaseChange,
} from "../../generated/schema";

// ─────────────────────────────────────────────
// Helper: get or create the singleton ElectionMeta entity
// ─────────────────────────────────────────────
function getOrCreateElectionMeta(): ElectionMeta {
  let meta = ElectionMeta.load("election");
  if (meta == null) {
    meta = new ElectionMeta("election");
    meta.state = 0;
    meta.candidatesCount = 0;
    meta.totalCommits = 0;
    meta.totalVotes = 0;
    meta.commitDeadline = BigInt.fromI32(0);
    meta.revealDeadline = BigInt.fromI32(0);
    meta.lastStateChangeBlock = BigInt.fromI32(0);
    meta.lastStateChangeTimestamp = BigInt.fromI32(0);
  }
  return meta;
}

// ─────────────────────────────────────────────
// Handler: CandidateAdded(indexed uint256, string, string)
// ─────────────────────────────────────────────
export function handleCandidateAdded(event: CandidateAdded): void {
  let candidateId = event.params.candidateId;
  let candidate = new Candidate(candidateId.toString());

  candidate.candidateId = candidateId;
  candidate.name = event.params.name;
  candidate.imageCID = event.params.imageCID;
  candidate.voteCount = 0;
  candidate.addedAtBlock = event.block.number;
  candidate.addedAtTimestamp = event.block.timestamp;
  candidate.save();

  // Update election meta
  let meta = getOrCreateElectionMeta();
  meta.candidatesCount = meta.candidatesCount + 1;
  meta.save();
}

// ─────────────────────────────────────────────
// Handler: ElectionStateChanged(uint8)
// ─────────────────────────────────────────────
export function handleElectionStateChanged(event: ElectionStateChanged): void {
  let id =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();

  let phaseChange = new ElectionPhaseChange(id);
  phaseChange.newState = event.params.newState;
  phaseChange.blockNumber = event.block.number;
  phaseChange.timestamp = event.block.timestamp;
  phaseChange.save();

  // Update singleton
  let meta = getOrCreateElectionMeta();
  meta.state = event.params.newState;
  meta.lastStateChangeBlock = event.block.number;
  meta.lastStateChangeTimestamp = event.block.timestamp;
  meta.save();
}

// ─────────────────────────────────────────────
// Handler: VoteCommitted(indexed address)
// ─────────────────────────────────────────────
export function handleVoteCommitted(event: VoteCommitted): void {
  let commit = new VoteCommit(event.transaction.hash.toHexString());
  commit.voter = event.params.voter;
  commit.blockNumber = event.block.number;
  commit.timestamp = event.block.timestamp;
  commit.transactionHash = event.transaction.hash;
  commit.save();

  let meta = getOrCreateElectionMeta();
  meta.totalCommits = meta.totalCommits + 1;
  meta.save();
}

// ─────────────────────────────────────────────
// Handler: VoteRevealed(indexed address, indexed uint256, string)
// ─────────────────────────────────────────────
export function handleVoteRevealed(event: VoteRevealed): void {
  let reveal = new VoteReveal(event.transaction.hash.toHexString());
  reveal.voter = event.params.voter;
  reveal.candidateId = event.params.candidateId;
  reveal.candidate = event.params.candidateId.toString();
  reveal.ballotProofCID = event.params.ballotProofCID;
  reveal.blockNumber = event.block.number;
  reveal.timestamp = event.block.timestamp;
  reveal.transactionHash = event.transaction.hash;
  reveal.save();

  // Update candidate vote count
  let candidate = Candidate.load(event.params.candidateId.toString());
  if (candidate != null) {
    candidate.voteCount = candidate.voteCount + 1;
    candidate.save();
  }

  // Update election meta
  let meta = getOrCreateElectionMeta();
  meta.totalVotes = meta.totalVotes + 1;
  meta.save();
}
