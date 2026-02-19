import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "./useWallet";
import { fetchBalance, type Balance } from "../util/wallet";
import { getFriendbotUrl } from "../util/friendbot";
import { getSelectedNetwork } from "../contracts/util";

const formatter = new Intl.NumberFormat();

const checkFunding = (balances: Balance[]) =>
  balances.some(({ balance }) =>
    !Number.isNaN(Number(balance)) ? Number(balance) > 0 : false,
  );

const hasFriendbot = () => {
  const net = getSelectedNetwork();
  return ["LOCAL", "TESTNET", "FUTURENET", "NOIR"].includes(net);
};

type WalletBalance = {
  balances: Balance[];
  xlm: string;
  isFunded: boolean;
  isLoading: boolean;
  error: Error | null;
};

export const useWalletBalance = () => {
  const { address } = useWallet();
  const autoFundAttempted = useRef<string | null>(null);
  const [state, setState] = useState<WalletBalance>({
    balances: [],
    xlm: "-",
    isFunded: false,
    isLoading: false,
    error: null,
  });

  const updateBalance = useCallback(async () => {
    if (!address) return;
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const balances = await fetchBalance(address);
      const isFunded = checkFunding(balances);
      const native = balances.find(({ asset_type }) => asset_type === "native");
      setState({
        isLoading: false,
        balances,
        xlm: native?.balance ? formatter.format(Number(native.balance)) : "-",
        isFunded,
        error: null,
      });
    } catch (err) {
      if (err instanceof Error && err.message.match(/not found/i)) {
        // Auto-fund via friendbot on non-mainnet networks (once per address)
        if (hasFriendbot() && autoFundAttempted.current !== address) {
          autoFundAttempted.current = address;
          setState((prev) => ({ ...prev, isLoading: true }));
          try {
            const res = await fetch(getFriendbotUrl(address));
            if (res.ok) {
              // Re-fetch balance after successful funding
              const balances = await fetchBalance(address);
              const isFunded = checkFunding(balances);
              const native = balances.find(({ asset_type }) => asset_type === "native");
              setState({
                isLoading: false,
                balances,
                xlm: native?.balance ? formatter.format(Number(native.balance)) : "-",
                isFunded,
                error: null,
              });
              return;
            }
          } catch {
            // Auto-fund failed, fall through to show unfunded state
          }
        }
        setState({
          isLoading: false,
          balances: [],
          xlm: "-",
          isFunded: false,
          error: new Error("Account not found. Fund your account to continue."),
        });
      } else {
        console.error(err);
        setState({
          isLoading: false,
          balances: [],
          xlm: "-",
          isFunded: false,
          error: new Error("Unknown error fetching balance."),
        });
      }
    }
  }, [address]);

  useEffect(() => {
    void updateBalance();
  }, [updateBalance]);

  return {
    ...state,
    updateBalance,
  };
};
