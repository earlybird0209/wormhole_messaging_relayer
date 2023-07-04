import { CHAINS, CHAIN_ID_ALGORAND, CHAIN_ID_POLYGON, TokenBridgePayload, ethers_contracts, parseSequenceFromLogAlgorand, parseTokenTransferPayload, redeemOnAlgorand, redeemOnEthNative } from "@certusone/wormhole-sdk";
import { StandardRelayerApp, StandardRelayerContext, Environment } from "../relayer";
import {  ALGORAND_BRIDGE_ID, ALGORAND_TOKEN_BRIDGE_ID, POLYGON_BRIDGE_ID, POLYGON_TOKEN_BRIDGE_ID, getAlgoConnection, getAlgoSigner, getPolyConnection, getPolySigner } from "./const";
import { Algorand } from "./algorand";
import { TransactionSignerPair, calcLogicSigAccount, submitVAAHeader } from "@certusone/wormhole-sdk/lib/cjs/algorand";
import algosdk, {
  Algodv2,
  bigIntToBytes,
  generateAccount,
  waitForConfirmation,
} from "@certusone/wormhole-sdk/node_modules/algosdk";

const conn = getAlgoConnection();
const algoSigner = getAlgoSigner();
const algorand = new Algorand(conn);
const polyProvider = getPolyConnection("maticmum")
const polySigner = getPolySigner(polyProvider);
const algorandAppId = "253500909";
const polygonContract = "0xeedb7Ba0cBB7315c4304cc5A76AC341038f5c827";


const myMiddleware = async (ctx: StandardRelayerContext, next: any) => {
  const vaa = ctx.vaa;
  const hash = ctx.sourceTxHash;
  let seq = ctx.vaa!.sequence.toString();
  console.info(vaa);
  console.info(vaa.payload.toString("hex"))
  //from polygon to algorand
  if(vaa.emitterAddress.toString("hex") == "000000000000000000000000eedb7ba0cbb7315c4304cc5a76ac341038f5c827"){
    
    let txns: TransactionSignerPair[] = [];
    // const submitState =await submitVAAHeader(conn, BigInt(ALGORAND_BRIDGE_ID), new Uint8Array(ctx.vaaBytes), algoSigner.getAddress(), BigInt(algorandAppId))
    // txns.push(...(submitState.txs));
    console.info("message to algorand received");
    const senderAddress = vaa.payload.subarray(0, 32);
    const params = await conn
      .getTransactionParams()
      .do();
    const m = algosdk.ABIMethod.fromSignature("receiveMessage(byte[])byte[]");
    txns.push({
      tx: algosdk.makeApplicationCallTxnFromObject({
          from: algoSigner.getAddress(),
          suggestedParams: params,
          appIndex: parseInt(algorandAppId),
          appArgs: [
            m.getSelector(),
            (m.args[0].type as algosdk.ABIType).encode(new Uint8Array(ctx.vaaBytes))
          ],
          onComplete: algosdk.OnApplicationComplete.NoOpOC,
          boxes: [{
            appIndex: parseInt(algorandAppId),
            name: new Uint8Array(senderAddress)
          }]
        }),
      signer: null
    })

    const result = await algorand.signSendWait(txns, algoSigner);
    console.log(result);

    return next();
  }
  if(vaa.emitterChain == CHAIN_ID_ALGORAND){
  }
  return next();
}

async function main() {
  const app = new StandardRelayerApp<StandardRelayerContext>(Environment.TESTNET, {
    name: "CCTRelayer",
  });

  // app
  //   .chain(CHAIN_ID_POLYGON)
  //   .address(polygonContract, myMiddleware);
  app
    .chain(CHAIN_ID_ALGORAND)
    .address(algorandAppId, myMiddleware);


  app.listen();
}



main();