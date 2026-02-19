import { createContext, useEffect, useMemo, useState } from "react";
import {
  devAddress,
  signTransaction,
  fundDevAccount,
} from "../util/devWallet";
import {
  stellarNetwork,
  networkPassphrase,
  getNetworkUrls,
} from "../contracts/util";

export interface WalletContextType {
  address?: string;
  network?: string;
  networkPassphrase?: string;
  isPending: boolean;
  signTransaction?: typeof signTransaction;
}

export const WalletContext = // eslint-disable-line react-refresh/only-export-components
  createContext<WalletContextType>({ isPending: true });

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Auto-fund on dev/test networks
      if (["LOCAL", "TESTNET", "FUTURENET", "NOIR"].includes(stellarNetwork)) {
        const { horizonUrl } = getNetworkUrls();
        await fundDevAccount(horizonUrl);
      }
      setIsPending(false);
    };
    void init();
  }, []);

  const contextValue = useMemo(
    () => ({
      address: devAddress,
      network: stellarNetwork,
      networkPassphrase,
      isPending,
      signTransaction,
    }),
    [isPending],
  );

  return <WalletContext value={contextValue}>{children}</WalletContext>;
};
