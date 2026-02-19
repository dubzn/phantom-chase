import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { networkPassphrase } from "../contracts/util";

// Load keypair from env var, or generate a random one
const secret = import.meta.env.PUBLIC_DEV_SECRET_KEY as string | undefined;
const keypair = secret ? Keypair.fromSecret(secret) : Keypair.random();

export const devAddress = keypair.publicKey();

// Log for dev visibility
if (secret) {
  console.log(`Dev wallet loaded: ${devAddress}`);
} else {
  console.log(`Dev wallet generated (random): ${devAddress}`);
  console.log(`Secret: ${keypair.secret()}`);
}

/**
 * Sign a transaction XDR using the dev keypair.
 * Matches the Stellar SDK SignTransaction type exactly.
 */
export const signTransaction = (
  xdr: string,
  opts?: {
    networkPassphrase?: string;
    address?: string;
    submit?: boolean;
    submitUrl?: string;
  },
): Promise<{ signedTxXdr: string; signerAddress: string }> => {
  const passphrase = opts?.networkPassphrase ?? networkPassphrase;
  const tx = TransactionBuilder.fromXDR(xdr, passphrase);
  tx.sign(keypair);
  return Promise.resolve({
    signedTxXdr: tx.toXDR(),
    signerAddress: keypair.publicKey(),
  });
};

/**
 * Fund the dev account via friendbot.
 */
export const fundDevAccount = async (
  horizonUrl: string,
): Promise<boolean> => {
  try {
    const res = await fetch(`${horizonUrl}/friendbot?addr=${devAddress}`);
    return res.ok;
  } catch {
    return false;
  }
};
