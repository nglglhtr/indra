import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import {
  createClient,
  expect,
  ETH_AMOUNT_MD,
  TOKEN_AMOUNT,
  getOnchainTransactionsForChannel,
} from "../util";

describe("Collateral", () => {
  let client: IConnextClient;
  let tokenAddress: string;
  let nodeSignerAddress: string;

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses.Token;
    nodeSignerAddress = client.config.nodeIdentifier;
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("happy case: node should collateralize ETH", async () => {
    await client.requestCollateral(AddressZero);
    const freeBalance = await client.getFreeBalance(AddressZero);
    expect(freeBalance[client.signerAddress]).to.be.eq("0");
    expect(freeBalance[nodeSignerAddress]).to.be.eq(ETH_AMOUNT_MD);

    const onchainTransactions = await getOnchainTransactionsForChannel(client.publicIdentifier);
    expect(onchainTransactions.length).to.equal(
      1,
      "Should only be 1 onchain transaction for this channel",
    );
    const [depositTx] = onchainTransactions;
    expect(depositTx.reason).to.equal("COLLATERALIZATION");
  });

  it("happy case: node should collateralize tokens", async () => {
    await client.requestCollateral(tokenAddress);
    const freeBalance = await client.getFreeBalance(tokenAddress);
    expect(freeBalance[client.signerAddress]).to.be.eq(Zero);
    expect(freeBalance[nodeSignerAddress]).to.be.least(TOKEN_AMOUNT);

    const onchainTransactions = await getOnchainTransactionsForChannel(client.publicIdentifier);
    expect(onchainTransactions.length).to.equal(
      1,
      "Should only be 1 onchain transaction for this channel",
    );
    const [depositTx] = onchainTransactions;
    expect(depositTx.reason).to.equal("COLLATERALIZATION");
  });
});
