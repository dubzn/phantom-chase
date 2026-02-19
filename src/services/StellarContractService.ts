/**
 * StellarContractService - Utility functions for Stellar blockchain interactions
 */

import { Buffer } from 'buffer';

/**
 * Transaction data extracted from a transaction result
 */
export interface TransactionData {
  txHash?: string;
  fee?: string;
  cpuInstructions?: number;
  success: boolean;
}

/**
 * Utility functions for Stellar contract interactions
 */
export class StellarContractService {
  static extractCpuInstructions(tx: any): number | undefined {
    const simulation = tx?.simulation;
    if (simulation && 'transactionData' in simulation) {
      const txData = simulation.transactionData as any;
      if (txData && txData._data && txData._data._attributes && txData._data._attributes.resources) {
        const resources = txData._data._attributes.resources;
        if (resources._attributes && 'instructions' in resources._attributes) {
          return parseInt(resources._attributes.instructions.toString());
        }
      }
    }
    return undefined;
  }

  static extractTransactionData(result: any): TransactionData {
    const txHash = result?.hash || result?.transactionHash || (typeof result === 'string' ? result : '');
    let fee: string | undefined;

    let txResponse: any = null;

    if (typeof result?.getTransactionResponse === 'function') {
      try {
        txResponse = result.getTransactionResponse();
      } catch {
        // Ignore errors
      }
    } else if (result?.response) {
      txResponse = result.response;
    } else if (result?.transactionResponse) {
      txResponse = result.transactionResponse;
    } else if (result && typeof result === 'object' && 'status' in result) {
      txResponse = result;
    }

    if (txResponse) {
      if (txResponse.resultXdr && typeof txResponse.resultXdr.feeCharged === 'function') {
        fee = txResponse.resultXdr.feeCharged().toString();
      } else if (txResponse.feeCharged) {
        fee = txResponse.feeCharged.toString();
      } else if (txResponse.fee) {
        fee = txResponse.fee.toString();
      }
    }

    return {
      txHash,
      fee,
      success: true,
    };
  }

  static formatStroopsToXlm(stroops: string | number): string {
    const stroopsNum = typeof stroops === 'string' ? parseInt(stroops) : stroops;
    return (stroopsNum / 10_000_000).toFixed(7);
  }

  static toBuffer(data: Uint8Array): Buffer {
    return Buffer.from(data);
  }
}
