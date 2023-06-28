import { NodeHttpTransport } from "@improbable-eng/grpc-web-node-http-transport";
import {
  getSignedVAAWithRetry,
  ChainId,
  WormholeWrappedInfo,
  uint8ArrayToHex,
  TokenTransfer,
} from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import { AlgorandSigner } from "./algorand";
import { ParsedVaaWithBytes } from "../relayer";

// Signer is a catchall for different chain signers
export type Signer =
  | AlgorandSigner
  | ethers.Signer

// WormholeAsset is just a wrapper
// around some specific chain and asset
export type WormholeAsset = {
  chain: WormholeChain;
  contract: string | bigint;
};

// WormholeReceipt should be used on
// destination chain to claim an asset or
// finish attesting a new asset
export type WormholeReceipt = {
  origin: WormholeChain; // The originating chain for an action
  destination: WormholeChain; // The destination chain for an action
  VAA: Uint8Array; // The signed VAA
};

// WormholeMessageType describes the type of messages
// that can be sent to Wormhole
export enum WormholeActionType {
  // Create a new asset, based on source asset
  Attestation = 1, 
  // Transfer asset from one chain to another
  AssetTransfer = 2,
  // Transfer asset + call smart contract with VAA passed containing custom payload
  ContractControlledTransfer = 3, 
}

// WormholeAttestation describes an intended creation of a new
// asset given the originating asset and destination chain
export type WormholeAttestation = {
  origin: WormholeAsset;
  sender: Signer;
  destination: WormholeChain;
  receiver: Signer;
};

// WormholeAssetTransfer describes an intended transfer of an asset
// From origin chain to destination chain
export type WormholeAssetTransfer = {
  origin: WormholeAsset;
  sender: Signer;
  destination: WormholeAsset;
  receiver: Signer;
  amount: bigint;
};

export type WormholeContractTransfer = {
  transfer: WormholeAssetTransfer;
  contract: string;
  payload: Uint8Array;
};

export type WormholeAction = {
  action: WormholeActionType;
  attestation?: WormholeAttestation;
  assetTransfer?: WormholeAssetTransfer;
  contractTransfer?: WormholeContractTransfer;
};

export interface WormholeChain {
  id: ChainId;

  emitterAddress(): Promise<string>;

  attest(asset: WormholeAttestation): Promise<string>;

  transfer(xfer: WormholeAssetTransfer): Promise<string>;
  contractTransfer(cxfer: WormholeContractTransfer): Promise<string>;

  contractRedeem(
    signer: Signer, 
    vaa: ParsedVaaWithBytes,
    parsed: TokenTransfer
  ): Promise<string>;

  createWrapped(
    signer: Signer,
    receipt: WormholeReceipt
  ): Promise<WormholeAsset>;

  // Gets the original contract/asset id and chain for this asset locally
  lookupOriginal(asset: string | bigint): Promise<WormholeWrappedInfo>;
  // Get the local contract/asset id for some original asset

  transactionComplete(receipt: WormholeReceipt): Promise<boolean>;

  getAssetAsString(asset: bigint | string): string;
  getAssetAsInt(asset: string | bigint): bigint;
}

export class Wormhole {
  rpcHosts: string[];

  constructor(rpc: string[]) {
    this.rpcHosts = rpc;
  }

  // getVAA gets the signed VAA given a sequence number and origin chain
  async getVAA(
    sequence: string,
    origin: WormholeChain,
    destination: WormholeChain,
    emitter?: string
  ): Promise<WormholeReceipt> {
    console.time("getvaa")
    if (emitter === undefined)
      emitter = await origin.emitterAddress()
    const { vaaBytes } = await getSignedVAAWithRetry(
      this.rpcHosts,
      origin.id,
      emitter,
      sequence,
      { transport: NodeHttpTransport() }
    );

    console.timeEnd("getvaa")
    return {
      VAA: vaaBytes,
      origin: origin,
      destination: destination,
    } as WormholeReceipt;
  }

  // getOrigin finds the originating asset information for a given asset
  async getOrigin(asset: WormholeAsset): Promise<WormholeWrappedInfo> {
    return asset.chain.lookupOriginal(asset.contract);
  }

  

  async contractTransfer(
    contractTransfer: WormholeContractTransfer
  ): Promise<WormholeReceipt> {
    const origin = contractTransfer.transfer.origin.chain;
    const destination = contractTransfer.transfer.destination.chain;
    const sequence = await origin.contractTransfer(contractTransfer);
    return await this.getVAA(sequence, origin, destination);
  }

  // Transfers tokens into WormHole
  // returns signed VAA
  async transfer(transfer: WormholeAssetTransfer): Promise<WormholeReceipt> {
    const origin = transfer.origin.chain;
    const destination = transfer.destination.chain;
    const sequence = await origin.transfer(transfer);
    return await this.getVAA(sequence, origin, destination);
  }

}
