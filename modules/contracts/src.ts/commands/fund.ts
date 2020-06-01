import { Address, DecString } from "@connext/types";
import * as tokenArtifacts from "@openzeppelin/contracts/build/contracts/ERC20Mintable.json";
import { Contract, Wallet } from "ethers";
import { AddressZero, EtherSymbol } from "ethers/constants";
import { formatEther, parseEther } from "ethers/utils";
import { Argv } from "yargs";

import { cliOpts } from "../constants";
import { getProvider } from "../utils";

export const fund = async (
  sender: Wallet,
  recipient: Address,
  amount: DecString,
  tokenAddress?: Address,
): Promise<void> => {
  if (tokenAddress && tokenAddress !== AddressZero) {
    const token = new Contract(tokenAddress, tokenArtifacts.abi as any, sender);
    const tx = await token.transfer(recipient, parseEther(amount));
    console.log(`Sending ${amount} tokens to ${recipient} via tx ${tx.hash}`);
    await sender.provider.waitForTransaction(tx.hash);
    const recipientBal =
      `${formatEther(await token.balanceOf(recipient))} tokens`;
    const senderBal =
      `${formatEther(await token.balanceOf(sender.address))} tokens`;
    console.log(`Tx mined! New balances: recipient ${recipientBal} | sender ${senderBal}`);
  } else {
    const tx = await sender.sendTransaction({
      to: recipient,
      value: parseEther(amount),
    });
    console.log(`Sending ${EtherSymbol} ${amount} to ${recipient} via tx: ${tx.hash}`);
    await sender.provider.waitForTransaction(tx.hash!);
    const recipientBal =
      `${EtherSymbol} ${formatEther(await sender.provider.getBalance(recipient))}`;
    const senderBal =
      `${EtherSymbol} ${formatEther(await sender.provider.getBalance(sender.address))}`;
    console.log(`Tx mined! New balances: recipient ${recipientBal} | sender ${senderBal}`);
  }
};

export const fundCommand = {
  command: "fund",
  describe: "Fund an address with a chunk of ETH or tokens",
  builder: (yargs: Argv) => {
    return yargs
      .option("a", cliOpts.tokenAddress)
      .option("f", cliOpts.fromMnemonic)
      .option("p", cliOpts.ethProvider)
      .option("t", cliOpts.toAddress)
      .option("q", cliOpts.amount)
      .demandOption(["p", "t"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    await fund(
      Wallet.fromMnemonic(argv.fromMnemonic).connect(getProvider(argv.ethProvider)),
      argv.toAddress,
      argv.amount,
      argv.tokenAddress,
    );
  },
};