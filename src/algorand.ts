import {
  ChainId,
  CHAIN_ID_ALGORAND,
  attestFromAlgorand,
  transferFromAlgorand,
  redeemOnAlgorand,
  parseSequenceFromLogAlgorand,
  getEmitterAddressAlgorand,
  getIsTransferCompletedAlgorand,
  WormholeWrappedInfo,
  getForeignAssetAlgorand,
  getOriginalAssetAlgorand,
  createWrappedOnAlgorand,
  tryNativeToHexString,
  safeBigIntToNumber,
  TokenTransfer,
  uint8ArrayToHex,
} from "@certusone/wormhole-sdk";
import { submitVAAHeader, TransactionSignerPair, _parseVAAAlgorand, assetOptinCheck, hexToNativeAssetBigIntAlgorand } from "@certusone/wormhole-sdk/lib/cjs/algorand";
import algosdk, {
  Algodv2,
  bigIntToBytes,
  generateAccount,
  waitForConfirmation,
} from "@certusone/wormhole-sdk/node_modules/algosdk";
import { ALGORAND_BRIDGE_ID, ALGORAND_TOKEN_BRIDGE_ID } from "./const";
import {
  WormholeAsset,
  WormholeAttestation,
  WormholeChain,
  WormholeReceipt,
  WormholeAssetTransfer,
  WormholeContractTransfer,
} from "./wormhole";
import { ParsedVaaWithBytes } from "../relayer";

export class AlgorandSigner {
  account: algosdk.Account;

  constructor(acct?: algosdk.Account) {
    this.account = acct === undefined ? generateAccount() : acct;
  }

  getAddress(): string {
    return this.account.addr;
  }

  async signTxn(txn: algosdk.Transaction): Promise<Uint8Array> {
    return txn.signTxn(this.account.sk);
  }
}

export class Algorand implements WormholeChain {
  coreId: bigint = BigInt(ALGORAND_BRIDGE_ID);
  tokenBridgeId: bigint = BigInt(ALGORAND_TOKEN_BRIDGE_ID);

  id: ChainId = CHAIN_ID_ALGORAND;

  client: Algodv2;

  constructor(client: Algodv2) {
    this.client = client;
  }
  attest(asset: WormholeAttestation): Promise<string> {
    throw new Error("Method not implemented.");
  }
  transfer(xfer: WormholeAssetTransfer): Promise<string> {
    throw new Error("Method not implemented.");
  }
  async lookupOriginal(asset: bigint): Promise<WormholeWrappedInfo> {
    return getOriginalAssetAlgorand(this.client, this.tokenBridgeId, asset);
  }

  async emitterAddress(): Promise<string> {
    return getEmitterAddressAlgorand(this.tokenBridgeId);
  }

  async redeem(
    signer: AlgorandSigner,
    vaa: ParsedVaaWithBytes,
    parsed: TokenTransfer
  ): Promise<string> {
    const params = await this.client
      .getTransactionParams()
      .do();
    const aid = Number(hexToNativeAssetBigIntAlgorand(uint8ArrayToHex(parsed.to)));
    const addr = algosdk.decodeAddress(algosdk.getApplicationAddress(aid));
    const asset = safeBigIntToNumber(hexToNativeAssetBigIntAlgorand(parsed.tokenTransferPayload.subarray(20).toString("hex")))
    let txns: TransactionSignerPair[] = [];
    if(!(await assetOptinCheck(this.client, BigInt(asset), algosdk.getApplicationAddress(aid)))){
      const m = algosdk.ABIMethod.fromSignature("optin(uint64)uint64");
      txns.push({
        tx: algosdk.makeApplicationCallTxnFromObject({
            from: signer.getAddress(),
            suggestedParams: params,
            appIndex: aid,
            appArgs: [
              m.getSelector(),
              (m.args[0].type as algosdk.ABIType).encode(asset)
            ],
            onComplete: algosdk.OnApplicationComplete.NoOpOC,
            foreignApps: [parseInt(ALGORAND_TOKEN_BRIDGE_ID)],
            foreignAssets: [asset]
          }),
        signer: null
      })
    } 
    const redeemTxs = await redeemOnAlgorand(
      this.client,
      this.tokenBridgeId,
      this.coreId,
      new Uint8Array(vaa.bytes),
      signer.getAddress()
    );
    console.log(redeemTxs.map(tx=>tx.tx.get_obj_for_encoding()))
      
    txns.push(...redeemTxs);
    const lastIdx = txns.length - 1
    console.log(asset);

    
    txns[lastIdx].tx.appAccounts ||= [];
    txns[lastIdx].tx.appAccounts?.push(addr);

    txns[lastIdx].tx.boxes ||= [];
    txns[lastIdx].tx.boxes?.push({appIndex: aid, name: new Uint8Array(parsed.tokenTransferPayload) });
    console.log(txns[lastIdx].tx.boxes);
    const result = await this.signSendWait(txns, signer);
    console.log(result);
    return parseSequenceFromLogAlgorand(result);
  }


  async contractRedeem(
    signer: AlgorandSigner,
    vaa: ParsedVaaWithBytes,
    parsed: TokenTransfer
  ): Promise<string> {


    const redeemTxs = await redeemOnAlgorand(
      this.client,
      this.tokenBridgeId,
      this.coreId,
      new Uint8Array(vaa.bytes),
      signer.getAddress()
    );

    const filteredTxs = []
    for(let stxn of redeemTxs){
      if(stxn.tx.appIndex !== Number(this.tokenBridgeId))
        filteredTxs.push(stxn)
    }

    const lastIdx = filteredTxs.length - 1
    const asset = safeBigIntToNumber(hexToNativeAssetBigIntAlgorand(parsed.tokenTransferPayload.subarray(20).toString("hex")))
    console.log(asset);

    const aid = Number(hexToNativeAssetBigIntAlgorand(uint8ArrayToHex(parsed.to)));
    const addr = algosdk.decodeAddress(algosdk.getApplicationAddress(aid));
    
    filteredTxs[lastIdx].tx.appAccounts ||= [];
    filteredTxs[lastIdx].tx.appAccounts?.push(addr);

    filteredTxs[lastIdx].tx.boxes ||= [];
    filteredTxs[lastIdx].tx.boxes?.push({appIndex: aid, name: new Uint8Array(parsed.tokenTransferPayload) });
    console.log(filteredTxs[lastIdx].tx.boxes);
    const result = await this.signSendWait(filteredTxs, signer);
    console.log(result);
    return parseSequenceFromLogAlgorand(result);
  }

  async createWrapped(
    signer: AlgorandSigner,
    receipt: WormholeReceipt
  ): Promise<WormholeAsset> {
    const txs = await createWrappedOnAlgorand(
      this.client,
      this.tokenBridgeId,
      this.coreId,
      signer.getAddress(),
      receipt.VAA
    );
    await this.signSendWait(txs, signer);

    return {} as WormholeAsset;
  }


  async contractTransfer(msg: WormholeContractTransfer) {
    const {transfer, contract, payload} = msg;

    if (typeof transfer.origin.contract !== "bigint")
      throw new Error("Expected bigint for asset, got string");

    const fee = 0;
    const transferTxs = await transferFromAlgorand(
      this.client,
      this.tokenBridgeId,
      this.coreId,
      await transfer.sender.getAddress(),
      transfer.origin.contract,
      transfer.amount,
      contract,
      transfer.destination.chain.id,
      BigInt(fee),
      payload
    );

    const result = await this.signSendWait(
      transferTxs,
      transfer.sender as AlgorandSigner
    );

    return parseSequenceFromLogAlgorand(result);
  }

  async submitHeader(vaa: Uint8Array, sender: AlgorandSigner, appId: bigint){
    const {vaaMap, accounts, txs, guardianAddr} = await submitVAAHeader(this.client, this.coreId, vaa, sender.getAddress(), appId)
    console.log(vaaMap, accounts, txs, guardianAddr)
    const result = await this.signSendWait( txs, sender)
    console.log(result)
  }


  async transactionComplete(receipt: WormholeReceipt): Promise<boolean> {
    return await getIsTransferCompletedAlgorand(
      this.client,
      this.tokenBridgeId,
      receipt.VAA
    );
  }


  getAssetAsString(asset: bigint | string): string {
    if (typeof asset == "string") return asset;
    return Buffer.from(bigIntToBytes(asset, 32)).toString('hex')
  }

  getAssetAsInt(asset: string): bigint {
    //TODO
    return BigInt(0);
  }

  async signSendWait(
    txns: TransactionSignerPair[],
    acct: AlgorandSigner
  ): Promise<Record<string,any>> {
    // Signer empty, take just tx
    const txs = txns.map((tx) => {
      return tx.tx;
    });

    // Group txns atomically
    algosdk.assignGroupID(txs);

    // Take the last txns id
    const txid: string = txs[txs.length - 1].txID();

    // If it came with a signer, use it
    const signedTxns: Uint8Array[] = await Promise.all(
      txns.map(async (tx) => {
        if (tx.signer) {
          return await tx.signer.signTxn(tx.tx);
        } else {
          return await acct.signTxn(tx.tx);
        }
      })
    );

    await this.client.sendRawTransaction(signedTxns).do();

    return await waitForConfirmation(this.client, txid, 2);
  }
}
