import * as Client from 'zk_hunt';
import { getZkHuntContractId, getNetworkUrls, getNetworkPassphrase } from './util';

// Re-export types from the generated package for frontend use
export type { Game } from 'zk_hunt';
export { GamePhase } from 'zk_hunt';

// Factory function that creates a new client instance with current config
export const createZkHuntClient = () => {
  const networkUrls = getNetworkUrls();
  const passphrase = getNetworkPassphrase();

  return new Client.Client({
    networkPassphrase: passphrase,
    contractId: getZkHuntContractId(),
    rpcUrl: networkUrls.rpcUrl,
    allowHttp: true,
    publicKey: undefined,
  });
};

export default createZkHuntClient();
