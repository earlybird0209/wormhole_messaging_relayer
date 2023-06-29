import { CHAINS, CHAIN_ID_ALGORAND, CHAIN_ID_POLYGON, TokenBridgePayload, ethers_contracts, parseSequenceFromLogAlgorand, parseTokenTransferPayload, redeemOnAlgorand, redeemOnEthNative } from "@certusone/wormhole-sdk";
import { StandardRelayerApp, StandardRelayerContext, Environment } from "../relayer";
import {  ALGORAND_BRIDGE_ID, ALGORAND_TOKEN_BRIDGE_ID, POLYGON_BRIDGE_ID, POLYGON_TOKEN_BRIDGE_ID, getAlgoConnection, getAlgoSigner, getPolyConnection, getPolySigner } from "./const";
import { Algorand } from "./algorand";
import { TransactionSignerPair, submitVAAHeader } from "@certusone/wormhole-sdk/lib/cjs/algorand";
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
const ourAppId = "234234234";


const myMiddleware = async (ctx: StandardRelayerContext, next: any) => {
  const vaa = ctx.vaa;
  const hash = ctx.sourceTxHash;
  let seq = ctx.vaa!.sequence.toString();
  const toChain = vaa.payload.readUInt16BE(0);
  if(toChain == CHAIN_ID_ALGORAND){
    
    let txns: TransactionSignerPair[] = [];
    // const submitState =await submitVAAHeader(conn, BigInt(ALGORAND_BRIDGE_ID), new Uint8Array(ctx.vaaBytes), algoSigner.getAddress(), BigInt(ourAppId))
    // txns.push(...(submitState.txs));
    console.info("message to algorand received", vaa);
    const senderAddress = vaa.payload.subarray(2, 22);
    const params = await conn
      .getTransactionParams()
      .do();
    const m = algosdk.ABIMethod.fromSignature("receiveMessage(byte[])byte[]");
    txns.push({
      tx: algosdk.makeApplicationCallTxnFromObject({
          from: algoSigner.getAddress(),
          suggestedParams: params,
          appIndex: parseInt(ourAppId),
          appArgs: [
            m.getSelector(),
            (m.args[0].type as algosdk.ABIType).encode(new Uint8Array(ctx.vaaBytes))
          ],
          onComplete: algosdk.OnApplicationComplete.NoOpOC,
          boxes: [{
            appIndex: parseInt(ourAppId),
            name: senderAddress
          }]
        }),
      signer: null
    })

    const result = await algorand.signSendWait(txns, algoSigner);
    console.log(result);

    return next();
  }
  if(toChain == CHAIN_ID_POLYGON){
    
  }
}

async function main() {
  const app = new StandardRelayerApp<StandardRelayerContext>(Environment.TESTNET, {
    name: "CCTRelayer",
  });

  app
    .chain(CHAIN_ID_POLYGON)
    .address(POLYGON_BRIDGE_ID, myMiddleware);
  app
    .chain(CHAIN_ID_ALGORAND)
    .address(ALGORAND_BRIDGE_ID, myMiddleware);


  app.listen();
}



main();