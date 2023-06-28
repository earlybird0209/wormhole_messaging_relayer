import algosdk, { generateAccount, mnemonicToSecretKey, Algodv2} from "@certusone/wormhole-sdk/node_modules/algosdk";
import { ethers } from "ethers";

export type Cluster = "devnet" | "testnet" | "mainnet";
export const CLUSTER: Cluster = "testnet";

export const ALGORAND_HOST =
  CLUSTER === "testnet"
    ? {
        algodToken: "",
        algodServer: "https://testnet-api.algonode.cloud",
        algodPort: "",
      }
    : {
        algodToken: "",
        algodServer: "https://mainnet-api.algonode.cloud",
        algodPort: "",
      };

export const ALGORAND_BRIDGE_ID = "86525623";
export const ALGORAND_TOKEN_BRIDGE_ID = "86525641";
export const POLYGON_BRIDGE_ID = "0x0CBE91CF822c73C2315FB05100C2F714765d5c20";
export const POLYGON_TOKEN_BRIDGE_ID = "0x377D55a7928c046E18eEbb61977e714d2a76472a";
export function getAlgoConnection(): Algodv2 {
    const { algodToken, algodServer, algodPort } = ALGORAND_HOST;
    return new Algodv2(algodToken, algodServer, algodPort);
}

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

export function getAlgoSigner(): AlgorandSigner {
    const mn =
        "luggage february galaxy midnight clerk panic valve mixed often jewel trumpet opinion camp female hamster glimpse shoot office crucial coconut buddy alien lottery abstract road";
    return new AlgorandSigner(mnemonicToSecretKey(mn));
}
      

export function getPolySigner(provider: any): ethers.Signer {
  const ETH_PRIVATE_KEY =
    "8a8c7e57dcdb4e1d6c5f68eec6832aa0d51429eda050f7a6c212b2c58f8e69d8";
  return new ethers.Wallet(ETH_PRIVATE_KEY, provider);
}

export function getPolyConnection(network?: string): ethers.providers.Provider {
  return new ethers.providers.EtherscanProvider(
    (network),
  );
}
