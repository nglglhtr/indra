import { MethodParams, CoinTransfer, HashLockTransferAppState, getAddressFromIdentifier } from "@connext/types";

import { unidirectionalCoinTransferValidation } from "../shared";

export const validateHashLockTransferApp = (
  params: MethodParams.ProposeInstall,
  blockNumber: number,
  initiatorIdentifier: string,
  responderIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit } = params;
  const initialState = params.initialState as HashLockTransferAppState;

  const initiatorSignerAddress = getAddressFromIdentifier(initiatorIdentifier);
  const responderSignerAddress = getAddressFromIdentifier(responderIdentifier);

  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === initiatorSignerAddress;
  })[0];
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === responderSignerAddress;
  })[0];

  if (initialState.timelock.lt(blockNumber)) {
    throw new Error(
      `Cannot install an app with an expired timelock. Timelock in state: ${initialState.timelock}. Current block: ${blockNumber}`,
    );
  }

  unidirectionalCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );
};
