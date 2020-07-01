import { MinimalTransaction } from "@connext/types";
import { stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { providers } from "ethers";

import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";

import { OnchainTransactionRepository } from "./onchainTransaction.repository";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransaction } from "./onchainTransaction.entity";

const NO_TX_HASH = "no transaction hash found in tx response";
export const MAX_RETRIES = 5;
export const KNOWN_ERRORS = ["the tx doesn't have the correct nonce", NO_TX_HASH];

@Injectable()
export class OnchainTransactionService {
  constructor(
    private readonly configService: ConfigService,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("OnchainTransactionService");
  }

  async sendWithdrawalCommitment(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<providers.TransactionReceipt> {
    const receipt = await this.sendTransaction(transaction, channel);
    await this.onchainTransactionRepository.addReclaim(receipt, channel);
    return receipt;
  }

  async sendWithdrawal(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<providers.TransactionReceipt> {
    const receipt = await this.sendTransaction(transaction, channel);
    await this.onchainTransactionRepository.addWithdrawal(receipt, channel);
    return receipt;
  }

  async sendDeposit(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<providers.TransactionReceipt> {
    const receipt = await this.sendTransaction(transaction, channel);
    await this.onchainTransactionRepository.addCollateralization(receipt, channel);
    return receipt;
  }

  findByHash(hash: string): Promise<OnchainTransaction | undefined> {
    return this.onchainTransactionRepository.findByHash(hash);
  }

  private async sendTransaction(
    transaction: MinimalTransaction,
    channel: Channel,
  ): Promise<providers.TransactionReceipt> {
    const wallet = this.configService.getSigner();
    const errors: { [k: number]: string } = [];
    let tx: providers.TransactionResponse;
    for (let attempt = 1; attempt < MAX_RETRIES + 1; attempt += 1) {
      try {
        this.log.info(`Attempt ${attempt}/${MAX_RETRIES} to send transaction to ${transaction.to}`);
        tx = await wallet.sendTransaction({
          ...transaction,
          nonce: await wallet.provider.getTransactionCount(await wallet.getAddress()),
        });
        await this.onchainTransactionRepository.addPending(tx, channel);
        // create the pending transaction in the db
        const receipt = await tx.wait();
        if (!tx.hash) {
          throw new Error(NO_TX_HASH);
        }
        this.log.info(`Success sending transaction! Tx hash: ${receipt.transactionHash}`);
        return receipt;
      } catch (e) {
        errors[attempt] = e.message;
        const knownErr = KNOWN_ERRORS.find((err) => e.message.includes(err));
        if (!knownErr) {
          this.log.error(`Transaction failed to send with unknown error: ${e.message}`);
          throw new Error(e.stack || e.message);
        }
        // known error, retry
        this.log.warn(
          `Sending transaction attempt ${attempt}/${MAX_RETRIES} failed: ${e.message}. Retrying.`,
        );
      }
    }
    await this.onchainTransactionRepository.markFailed(tx, errors);
    throw new Error(`Failed to send transaction (errors indexed by attempt): ${stringify(errors)}`);
  }
}
