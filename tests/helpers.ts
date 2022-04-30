import {
  Tx,
  Account,
  types,
  Chain,
} from "https://deno.land/x/clarinet@v0.14.0/index.ts";

interface Round {
  roundAdmin?: string;
  donationToken?: string;
  matchingToken?: string;
  startBlock?: number;
  endBlock?: number;
  meta?: string;
  proposals?: number[];
}

interface Proposal {
  owner?: string;
  meta?: string;
}

interface Donation {
  proposalId: number;
  token: string;
  amount: number;
  roundId: number;
}

interface Match {
  roundId: number;
  token: string;
  amount: number;
  anon?: boolean;
}

interface Claim {
  roundId: number;
  proposalId: number;
  token: string;
}

export const contractName = "quadratic";
export const tokenName = "miamicoin-token";

export const tokenPrincipal = (deployer: Account) =>
  `${deployer.address}.${tokenName}`;

/////////////////
//ROUND HELPERS//
/////////////////

export const makeRound = (round: Round) =>
  types.tuple({
    "round-admin": types.principal(round.roundAdmin!),
    "donation-token": types.principal(round.donationToken!),
    "matching-token": types.principal(round.matchingToken!),
    "start-at": types.uint(round.startBlock!),
    "end-at": types.uint(round.endBlock!),
    meta: types.ascii(round.meta!),
    proposals: round.proposals
      ? types.some(types.list(round.proposals.map((i) => types.uint(i))))
      : types.none(),
  });

export const makeRoundUpdate = (round: Round) =>
  types.tuple({
    "round-admin": round.roundAdmin
      ? types.some(types.principal(round.roundAdmin))
      : types.none(),
    "donation-token": round.donationToken
      ? types.some(types.principal(round.donationToken))
      : types.none(),
    "matching-token": round.matchingToken
      ? types.some(types.principal(round.matchingToken))
      : types.none(),
    "start-at": round.startBlock
      ? types.some(types.uint(round.startBlock))
      : types.none(),
    "end-at": round.endBlock
      ? types.some(types.uint(round.endBlock))
      : types.none(),
    meta: round.meta ? types.some(types.ascii(round.meta)) : types.none(),
  });

export const makeRoundTx = (maker: Account, round: Round) =>
  Tx.contractCall(
    contractName,
    "create-round",
    [makeRound(round)],
    maker.address
  );

export const getRound = (chain: Chain, caller: Account, id: number) =>
  chain.callReadOnlyFn(
    contractName,
    "get-round",
    [types.uint(id)],
    caller.address
  );

export const replaceProposalsTx = (
  maker: Account,
  roundId: number,
  proposalIds: number[]
) =>
  Tx.contractCall(
    contractName,
    "replace-proposals",
    [types.uint(roundId), types.list(proposalIds.map((id) => types.uint(id)))],
    maker.address
  );

export const makeTokenTx = (caller: Account, token: string) =>
  Tx.contractCall(
    contractName,
    "set-token",
    [types.principal(token)],
    caller.address
  );
////////////////////
//PROPOSAL HELPERS//
////////////////////

export const makeProposal = (proposal: Proposal) =>
  types.tuple({
    owner: types.principal(proposal.owner!),
    meta: types.ascii(proposal.meta!),
  });

export const makeProposalUpdate = (proposal: Proposal) =>
  types.tuple({
    owner: proposal.owner
      ? types.some(types.principal(proposal.owner))
      : types.none(),
    meta: proposal.meta ? types.some(types.ascii(proposal.meta)) : types.none(),
  });

export const makeProposalTx = (maker: Account, proposal: Proposal) =>
  Tx.contractCall(
    contractName,
    "create-proposal",
    [makeProposal(proposal)],
    maker.address
  );

export const makeProposalUpdateTx = (
  updater: Account,
  proposalId: number,
  proposal: Proposal
) =>
  Tx.contractCall(
    contractName,
    "update-proposal",
    [types.uint(proposalId), makeProposalUpdate(proposal)],
    updater.address
  );

export const getProposal = (chain: Chain, caller: Account, id: number) =>
  chain.callReadOnlyFn(
    contractName,
    "get-proposal",
    [types.uint(id)],
    caller.address
  );

/////////////////
//MATCH HELPERS//
/////////////////

export const makeMatch = (match: Match) => [
  types.uint(match.roundId),
  types.principal(match.token),
  types.uint(match.amount),
];

export const makeMatchTx = (matcher: Account, match: Match) =>
  Tx.contractCall(contractName, "add-match", makeMatch(match), matcher.address);

export const getMatch = (
  chain: Chain,
  caller: Account,
  roundId: number,
  proposalId: number
) =>
  chain.callReadOnlyFn(
    contractName,
    "get-round",
    [types.uint(roundId), types.uint(proposalId)],
    caller.address
  );

export const makeRoundUpdateTx = (
  updater: Account,
  roundId: number,
  round: Round
) =>
  Tx.contractCall(
    contractName,
    "update-round",
    [types.uint(roundId), makeRoundUpdate(round)],
    updater.address
  );

////////////////////
//DONATION HELPERS//
////////////////////

export const makeDonation = (donation: Donation) => [
  types.uint(donation.proposalId),
  types.principal(donation.token),
  types.uint(donation.amount),
  types.uint(donation.roundId),
];

export const makeDonationTx = (donator: Account, donation: Donation) =>
  Tx.contractCall(
    contractName,
    "donate",
    makeDonation(donation),
    donator.address
  );

/////////////////
//CLAIM HELPERS//
/////////////////

export const makeClaim = (claim: Claim) => [
  types.uint(claim.roundId),
  types.uint(claim.proposalId),
  types.principal(claim.token),
];

export const makeClaimTx = (claimant: Account, claim: Claim) =>
  Tx.contractCall(
    contractName,
    "claim-single",
    makeClaim(claim),
    claimant.address
  );
