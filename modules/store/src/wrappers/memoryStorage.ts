import {
  AppInstanceJson,
  AppInstanceProposal,
  ConditionalTransactionCommitmentJSON,
  IBackupServiceAPI,
  IClientStore,
  MinimalTransaction,
  SetStateCommitmentJSON,
  StateChannelJSON,
  STORE_SCHEMA_VERSION,
  WithdrawalMonitorObject,
} from "@connext/types";

export class MemoryStorage implements IClientStore {
  private schemaVersion: number = STORE_SCHEMA_VERSION;
  private channels: Map<string, StateChannelJSON> = new Map();
  private setStateCommitments: Map<string, SetStateCommitmentJSON> = new Map();
  private conditionalTxCommitment: Map<
    string,
    ConditionalTransactionCommitmentJSON
  > = new Map();
  private withdrawals: Map<string, MinimalTransaction> = new Map();
  private proposedApps: Map<string, AppInstanceProposal> = new Map();
  private appInstances: Map<string, AppInstanceJson> = new Map();
  private userWithdrawals: WithdrawalMonitorObject | undefined = undefined;
  private freeBalances: Map<string, AppInstanceJson> = new Map();

  constructor(private readonly backupService: IBackupServiceAPI | undefined = undefined) {}

  getSchemaVersion(): number {
    return this.schemaVersion;
  }

  async getAllChannels(): Promise<StateChannelJSON[]> {
    return [...this.channels.values()];
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    return this.channels.get(multisigAddress);
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    return [...this.channels.values()].find(
      channel => channel.userNeuteredExtendedKeys.sort().toString() === owners.sort().toString(),
    );
  }

  async getStateChannelByAppInstanceId(
    appInstanceId: string,
  ): Promise<StateChannelJSON | undefined> {
    return [...this.channels.values()].find(channel => {
      return (
        channel.proposedAppInstances.find(([app]) => app === appInstanceId) ||
        channel.appInstances.find(([app]) => app === appInstanceId) ||
        (channel.freeBalanceAppInstance &&
          channel.freeBalanceAppInstance.identityHash === appInstanceId)
      );
    });
  }

  async saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    this.channels.set(stateChannel.multisigAddress, stateChannel);
  }

  async getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined> {
    return this.appInstances.get(appInstanceId);
  }

  async saveAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    const channel = this.channels.get(multisigAddress);
    if (!channel) {
      throw new Error(`Channel not found: ${multisigAddress}`);
    }
    this.appInstances.set(appInstance.identityHash, appInstance);
  }

  removeAppInstance(appInstanceId: string): Promise<void> {
    this.appInstances.delete(appInstanceId);
    return Promise.resolve();
  }

  async getLatestSetStateCommitment(
    appInstanceId: string,
  ): Promise<SetStateCommitmentJSON | undefined> {
    return this.setStateCommitments.get(appInstanceId);
  }

  async saveLatestSetStateCommitment(
    appInstanceId: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    this.setStateCommitments.set(appInstanceId, commitment);
  }

  async getConditionalTransactionCommitment(
    appInstanceId: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    return this.conditionalTxCommitment.get(appInstanceId);
  }

  async saveConditionalTransactionCommitment(
    appInstanceId: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    this.conditionalTxCommitment.set(appInstanceId, commitment);
  }

  async getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<MinimalTransaction | undefined> {
    return this.withdrawals.get(multisigAddress);
  }

  async saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    this.withdrawals.set(multisigAddress, commitment);
  }

  getAppProposal(appInstanceId: string): Promise<AppInstanceProposal | undefined> {
    if (!this.proposedApps.has(appInstanceId)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.proposedApps.get(appInstanceId));
  }

  saveAppProposal(appInstanceId: string, proposal: AppInstanceProposal): Promise<void> {
    this.proposedApps.set(appInstanceId, proposal);
    return Promise.resolve();
  }

  removeAppProposal(appInstanceId: string): Promise<void> {
    this.appInstances.delete(appInstanceId);
    return Promise.resolve();
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    if (!this.freeBalances.has(multisigAddress)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.freeBalances.get(multisigAddress));
  }

  saveFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    this.freeBalances.set(multisigAddress, freeBalance);
    return Promise.resolve();
  }

  async getUserWithdrawal(): Promise<WithdrawalMonitorObject> {
    return this.userWithdrawals;
  }

  async setUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    this.userWithdrawals = withdrawalObject;
  }

  async clear(): Promise<void> {
    this.channels = new Map();
    this.withdrawals = new Map();
    this.appInstances = new Map();
    this.userWithdrawals = undefined;
  }

  async restore(): Promise<void> {
    await this.clear();
    if (!this.backupService) {
      throw new Error(`No backup provided, store cleared`);
    }
    throw new Error(`Method not implemented for MemoryStorage`);
  }
}
