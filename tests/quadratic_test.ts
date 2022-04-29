import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types,
} from "https://deno.land/x/clarinet@v0.14.0/index.ts";
import { assertEquals } from "https://deno.land/std@0.90.0/testing/asserts.ts";

import {
  tokenPrincipal,
  makeDonationTx,
  makeMatchTx,
  contractName,
  makeProposalTx,
  makeRoundTx,
  makeRoundUpdateTx,
  getRound,
  makeProposalUpdateTx,
  makeClaimTx,
  replaceProposalsTx,
} from "./helpers.ts";

Clarinet.test({
  name: "Can create a grant round",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const [deployer, maker] = ["deployer", "wallet_1"].map(
      (name) => accounts.get(name)!
    );

    const round = {
      roundAdmin: maker.address,
      donationToken: tokenPrincipal(deployer),
      matchingToken: tokenPrincipal(deployer),
      startBlock: 1,
      endBlock: 10,
      meta: "https://someUrlToPointer.com",
    };

    const block = chain.mineBlock([
      makeRoundTx(maker, round),
      makeRoundTx(maker, { ...round, startBlock: 5, proposals: [0, 1] }),
    ]);
    block.receipts[0].result.expectErr().expectUint(201);
    block.receipts[1].result.expectOk();
  },
});

Clarinet.test({
  name: "Correct user can update a grant round",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const [deployer, maker, unauthorized] = [
      "deployer",
      "wallet_1",
      "wallet_2",
    ].map((name) => accounts.get(name)!);

    const round = {
      roundAdmin: maker.address,
      donationToken: tokenPrincipal(deployer),
      matchingToken: tokenPrincipal(deployer),
      startBlock: 1,
      endBlock: 10,
      meta: "https://someUrlToPointerReplace.com",
    };

    let block = chain.mineBlock([
      makeRoundTx(maker, round),
      makeRoundTx(maker, { ...round, startBlock: 5, proposals: [0, 1] }),
    ]);
    block.receipts[0].result.expectErr().expectUint(201);
    block.receipts[1].result.expectOk();
    block = chain.mineBlock([
      makeRoundUpdateTx(maker, 0, { startBlock: 8 }),
      makeRoundUpdateTx(unauthorized, 0, { startBlock: 8 }),
    ]);
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectErr().expectUint(401);
    const updatedRound = getRound(chain, deployer, 0);
    assertEquals(
      updatedRound.result.expectOk(),
      '{donation-token: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.miamicoin-token, end-at: u10, match: u0, matching-token: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.miamicoin-token, meta: "https://someUrlToPointerReplace.com", proposals: (some []), round-admin: ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5, start-at: u8}'
    );
  },
});

Clarinet.test({
  name: "Can replace proposals for a grant round",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const [deployer, maker] = ["deployer", "wallet_1", "wallet_2"].map(
      (name) => accounts.get(name)!
    );

    const proposal = {
      owner: maker.address,
      meta: "https://someUrlToPointer.com",
    };
    chain.mineBlock([
      makeProposalTx(maker, proposal),
      makeProposalTx(maker, proposal),
      makeProposalTx(maker, proposal),
      makeProposalTx(maker, proposal),
    ]);
    const round = {
      roundAdmin: maker.address,
      donationToken: tokenPrincipal(deployer),
      matchingToken: tokenPrincipal(deployer),
      startBlock: 5,
      endBlock: 10,
      meta: "https://someUrlToPointerReplace.com",
      proposals: [0, 1],
    };

    chain.mineBlock([makeRoundTx(maker, round)]);
    let block = chain.mineBlock([
      replaceProposalsTx(maker, 0, [2, 3]),
      replaceProposalsTx(deployer, 0, [2, 3]),
    ]);

    assertEquals(
      block.receipts[0].result,
      '(ok {payload: {block-height: u3, round-id: u0}, type: "replace-proposals"})'
    );
    block.receipts[1].result.expectErr().expectUint(401);
  },
});

Clarinet.test({
  name: "Can create a proposal",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const [maker] = ["wallet_1"].map((name) => accounts.get(name)!);

    const proposal = {
      owner: maker.address,
      meta: "https://someUrlToPointer.com",
    };

    const block = chain.mineBlock([makeProposalTx(maker, proposal)]);
    block.receipts[0].result.expectOk();
  },
});

Clarinet.test({
  name: "Correct user can update a proposal",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const [maker, unauthorized] = ["wallet_1", "wallet_2"].map(
      (name) => accounts.get(name)!
    );

    const proposal = {
      owner: maker.address,
      meta: "https://someUrlToPointer.com",
    };

    let block = chain.mineBlock([makeProposalTx(maker, proposal)]);

    block.receipts[0].result.expectOk();

    block = chain.mineBlock([
      makeProposalUpdateTx(maker, 0, {
        meta: "https://someUrlToPointerReplace.com",
      }),
      makeProposalUpdateTx(unauthorized, 0, {
        meta: "https://someUrlToPointerReplace.com",
      }),
    ]);

    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectErr().expectUint(401);
  },
});

Clarinet.test({
  name: "Can send a match",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const [deployer, maker] = ["deployer", "wallet_1"].map(
      (name) => accounts.get(name)!
    );

    const round = {
      roundAdmin: maker.address,
      donationToken: tokenPrincipal(deployer),
      matchingToken: tokenPrincipal(deployer),
      startBlock: 5,
      endBlock: 10,
      meta: "https://someUrlToPointerReplace.com",
    };

    const match = {
      roundId: 0,
      token: tokenPrincipal(deployer),
      amount: 10000000000,
    };

    let block = chain.mineBlock([makeRoundTx(maker, round)]);
    block = chain.mineBlock([makeMatchTx(maker, match)]);
    block.receipts[0].result.expectOk();
    block.receipts[0].events.expectFungibleTokenTransferEvent(
      match.amount,
      maker.address,
      `${deployer.address}.${contractName}`,
      `${tokenPrincipal(deployer)}::miamicoin`
    );
  },
});

Clarinet.test({
  name: "Can claim funds after round",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const [deployer, wal1, wal2, wal3, wal4, wal5, wal6, wal7, wal8] = [
      "deployer",
      "wallet_1",
      "wallet_2",
      "wallet_3",
      "wallet_4",
      "wallet_5",
      "wallet_6",
      "wallet_7",
      "wallet_8",
    ].map((name) => accounts.get(name)!);

    const proposal = {
      owner: deployer.address,
      meta: "https://someUrlToPointer.com",
    };

    const donation = {
      token: tokenPrincipal(deployer),
      roundId: 0,
    };

    const round = {
      roundAdmin: deployer.address,
      donationToken: tokenPrincipal(deployer),
      matchingToken: tokenPrincipal(deployer),
      startBlock: 5,
      endBlock: 10,
      meta: "https://someUrlToPointer.com",
    };

    const match = {
      roundId: 0,
      token: tokenPrincipal(deployer),
      amount: 10000,
    };

    chain.mineBlock([
      makeProposalTx(deployer, proposal),
      makeProposalTx(deployer, proposal),
      makeProposalTx(deployer, proposal),
      makeProposalTx(deployer, proposal),
    ]);

    chain.mineBlock([
      makeRoundTx(deployer, { ...round, proposals: [0, 1, 2, 3] }),
      makeMatchTx(wal1, match),
    ]);

    chain.mineEmptyBlock(5);

    chain.mineBlock([
      makeDonationTx(wal2, { ...donation, amount: 10, proposalId: 0 }),
      makeDonationTx(wal3, { ...donation, amount: 20, proposalId: 0 }),
      makeDonationTx(wal4, { ...donation, amount: 30, proposalId: 0 }),
      makeDonationTx(wal5, { ...donation, amount: 10, proposalId: 1 }),
      makeDonationTx(wal6, { ...donation, proposalId: 2, amount: 9 }),
      makeDonationTx(wal7, { ...donation, proposalId: 2, amount: 10 }),
      makeDonationTx(wal8, { ...donation, proposalId: 3, amount: 8 }),
    ]);

    const claim = chain.callReadOnlyFn(
      contractName,
      "get-match",
      [types.uint(0), types.uint(0)],
      deployer.address
    );

    assertEquals(
      claim.result.expectOk(),
      "{claimed: false, funding-amount: u60, match: u7543}"
    );

    let block = chain.mineBlock([
      makeClaimTx(deployer, {
        roundId: 0,
        proposalId: 0,
        token: tokenPrincipal(deployer),
      }),
    ]);

    block.receipts[0].result.expectErr().expectUint(217);
    chain.mineEmptyBlock(5);

    block = chain.mineBlock([
      makeClaimTx(deployer, {
        roundId: 0,
        proposalId: 0,
        token: tokenPrincipal(deployer),
      }),
      makeClaimTx(deployer, {
        roundId: 0,
        proposalId: 1,
        token: tokenPrincipal(deployer),
      }),
      makeClaimTx(deployer, {
        roundId: 0,
        proposalId: 2,
        token: tokenPrincipal(deployer),
      }),
    ]);

    block.receipts[0].events.expectFungibleTokenTransferEvent(
      7543,
      `${deployer.address}.${contractName}`,
      deployer.address,
      `${tokenPrincipal(deployer)}::miamicoin`
    );

    block = chain.mineBlock([
      makeClaimTx(deployer, {
        roundId: 0,
        proposalId: 0,
        token: tokenPrincipal(deployer),
      }),
    ]);

    block.receipts[0].result.expectErr().expectUint(216);

    const hasClaimed = chain.callReadOnlyFn(
      contractName,
      "get-match",
      [types.uint(0), types.uint(0)],
      deployer.address
    ).result;

    assertEquals(
      hasClaimed,
      "(ok {claimed: true, funding-amount: u60, match: u7543})"
    );
  },
});

// const data = [
//   { funding: [10, 20, 30], fundingAmount: 0, match: 0 },
//   { funding: [10], fundingAmount: 0, match: 0 },
//   { funding: [9, 10], fundingAmount: 0, match: 0 },
//   { funding: [8], fundingAmount: 0, match: 0 },
// ];

// const match = 10000;

// const calculateMatch = () => {
//   let newData = data; // Collect data
//   let summed = 0; // Setup summed grant contributions

//   // Loop over each grant
//   for (let i = 0; i < newData.length; i++) {
//     let sumAmount = 0;

//     // Sum the square root of each grant contribution
//     for (let j = 0; j < newData[i].funding.length; j++) {
//       sumAmount += Math.sqrt(newData[i].funding[j]);
//     }

//     // Square the total value of each summed grants contributions
//     sumAmount *= sumAmount;
//     console.log("HEYO", sumAmount);
//     newData[i].match = sumAmount;
//     summed += sumAmount;
//   }

//   // Setup a divisor based on available match
//   let divisor = match / summed;
//   console.log("TOTAL", match);
//   console.log("SUMMED", summed);
//   console.log("DIVISOR", divisor);
//   // Multiply matched values with divisor to get match amount in range of available funds
//   for (let i = 0; i < newData.length; i++) {
//     newData[i].match *= divisor;
//     newData[i].fundingAmount += newData[i].funding.reduce((a, b) => a + b, 0);
//   }

//   return newData;
// };

// block.receipts[3].events.expectFungibleTokenTransferEvent(price, taker.address, maker.address, paymentAssetId);

// receipt.events.expectSTXTransferEvent(orders[i].price, takers[i].address, makers[i].address);

// Clarinet.test({
//   name: "Can send a donation",
//   async fn(chain: Chain, accounts: Map<string, Account>) {
//     const [deployer, maker] = ["deployer", "wallet_1"].map(
//       (name) => accounts.get(name)!
//     );

//     const block = chain.mineBlock([
//       Tx.contractCall(contractName, "test", [], maker.address),
//     ]);
//     console.log(block);

//     const tally = chain.callReadOnlyFn(
//       contractName,
//       "get-tally",
//       [types.uint(0), types.uint(0)],
//       deployer.address
//     );

//     console.log(tally);
//   },
// });
