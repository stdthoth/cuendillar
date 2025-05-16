import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { Connection, Keypair } from "@solana/web3.js";

export const user = Keypair.fromSecretKey(
    new Uint8Array(bs58.decode(process.env.USER_PRIVATE_KEY ||""))
);

export const RPC = process.env.RPC || "https://api.devnet.solana.com";
export const connection = new Connection(RPC, "finalized");