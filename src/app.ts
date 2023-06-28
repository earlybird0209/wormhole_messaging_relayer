import { CHAINS, CHAIN_ID_ALGORAND, CHAIN_ID_POLYGON, TokenBridgePayload, parseTokenTransferPayload, redeemOnAlgorand, redeemOnEthNative } from "@certusone/wormhole-sdk";
import { StandardRelayerApp, StandardRelayerContext, Environment } from "../relayer";
import {  ALGORAND_BRIDGE_ID, POLYGON_BRIDGE_ID, POLYGON_TOKEN_BRIDGE_ID, getAlgoConnection, getAlgoSigner, getPolyConnection, getPolySigner } from "./const";
import { Algorand } from "./algorand";

const myMiddleware = async (ctx: StandardRelayerContext, next: any) => {
  const vaa = ctx.vaa;
  const hash = ctx.sourceTxHash;
  let seq = ctx.vaa!.sequence.toString();
  const toChain = vaa.payload.readUInt16BE(0);
  if(toChain == CHAIN_ID_ALGORAND){
    
  }
  if(toChain == CHAIN_ID_POLYGON){

  }
}

async function main() {
  const app = new StandardRelayerApp<StandardRelayerContext>(Environment.TESTNET, {
    name: "CCTRelayer",
  });
  const conn = getAlgoConnection();
  const algoSigner = getAlgoSigner();
  const algorand = new Algorand(conn);
  const polyProvider = getPolyConnection("maticmum")
  const polySigner = getPolySigner(polyProvider);

  app
    .chain(CHAIN_ID_POLYGON)
    .address(POLYGON_BRIDGE_ID, myMiddleware);
  app
    .chain(CHAIN_ID_ALGORAND)
    .address(ALGORAND_BRIDGE_ID, myMiddleware);
  app
    .tokenBridge(
      [CHAIN_ID_ALGORAND, CHAIN_ID_POLYGON],
      async (ctx, next) => {
        const vaa = ctx.vaa;
        const hash = ctx.sourceTxHash;
        let seq = ctx.vaa!.sequence.toString();
        const payloadType = vaa.payload.readUint8(0)
        if (payloadType != TokenBridgePayload.Transfer &&
          payloadType != TokenBridgePayload.TransferWithPayload) {
          return;
        }
        
        //here is the part parsing payload
        let parsed = parseTokenTransferPayload(ctx.vaa.payload)
        //this is contract id
        //if((parsed.to.toString('hex') == '00000000000000000000000000000000000000000000000000000000055947a6')
        if(parsed.toChain == CHAIN_ID_ALGORAND) {

          console.log(vaa);
          console.log(parsed);
          console.log(vaa.bytes);
          console.log("destination contract address", parsed.to);
          const ret = await algorand.redeem(algoSigner, ctx.vaa, parsed);
          console.log(ret);
          return next();
        } 
        if(parsed.toChain == CHAIN_ID_POLYGON) {

          console.log(vaa);
          console.log(parsed);
          console.log(vaa.bytes);
          console.log("destination contract address", parsed.to);
          const ret = await redeemOnEthNative(POLYGON_TOKEN_BRIDGE_ID, polySigner, new Uint8Array(vaa.bytes));
          console.log(ret);
          return next();

        }

      },
    )


  app.listen();
}



main();