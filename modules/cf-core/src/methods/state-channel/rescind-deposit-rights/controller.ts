import ERC20 from "@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/ERC20.json";
import { Zero } from "ethers/constants";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { RequestHandler } from "../../../request-handler";
import { Node } from "../../../types";
import { NodeController } from "../../controller";
import { uninstallBalanceRefundApp } from "../deposit/operation";
import { BigNumber } from "ethers/utils";
import { Contract } from "ethers";

export default class RescindDepositRightsController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.RESCIND_DEPOSIT_RIGHTS)
  public executeMethod: (
    requestHandler: RequestHandler,
    params: Node.MethodParams
  ) => Promise<Node.MethodResult> = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: Node.RescindDepositRightsParams
  ): Promise<string[]> {
    return [params.multisigAddress];
  }

  protected async beforeExecution(): Promise<void> {}

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.RescindDepositRightsParams
  ): Promise<Node.DepositResult> {
    const { provider, store, networkContext } = requestHandler;
    const { multisigAddress } = params;

    const channel = await store.getStateChannel(multisigAddress);
    if (!channel.hasAppInstanceOfKind(networkContext.CoinBalanceRefundApp)) {
      return {
        multisigBalance: await provider.getBalance(multisigAddress)
      };
    }

    const balanceRefundApp = channel.getAppInstanceOfKind(
      networkContext.CoinBalanceRefundApp
    );
    let multisigBalance: BigNumber;
    const tokenAddress = balanceRefundApp.latestState["tokenAddress"];
    if (tokenAddress === CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
      multisigBalance = await provider.getBalance(multisigAddress);
    } else {
      const erc20Contract = new Contract(tokenAddress!, ERC20.abi, provider);
      multisigBalance = await erc20Contract.balanceOf(multisigAddress);
    }

    const blockNumber = await provider.getBlockNumber();

    await uninstallBalanceRefundApp(
      requestHandler,
      {
        ...params,
        // unused params to make types happy
        tokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        amount: Zero
      },
      blockNumber
    );

    return {
      multisigBalance
    };
  }
}