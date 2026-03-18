import { Wallet, LogOut, Loader2, AlertCircle, CheckCircle2, X, ExternalLink, Smartphone, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

function detectBrowser() {
  const ua = navigator.userAgent;
  const vendor = navigator.vendor ?? "";
  const isSafari = /Safari/.test(ua) && /Apple Computer/.test(vendor) && !/Chrome/.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && /Google Inc/.test(vendor);
  const isBrave = !!(navigator as any).brave;
  const isEdge = /Edg\//.test(ua);
  const isChromiumBased = isChrome || isBrave || isEdge;
  return { isSafari, isFirefox, isChromiumBased };
}

const WALLET_META: Record<
  string,
  {
    type: "mobile" | "extension";
    description: string;
    browsers: string[];
    installUrl?: string;
  }
> = {
  pera: {
    type: "mobile",
    description: "Scan QR with Pera Mobile",
    browsers: ["Chrome", "Firefox", "Safari", "Edge"],
  },
  defly: {
    type: "mobile",
    description: "Scan QR with Defly Mobile",
    browsers: ["Chrome", "Firefox", "Safari", "Edge"],
  },
  kibisis: {
    type: "extension",
    description: "Browser extension",
    browsers: ["Chrome", "Firefox", "Brave"],
    installUrl: "https://kibis.is",
  },
  lute: {
    type: "extension",
    description: "Chrome extension",
    browsers: ["Chrome", "Brave"],
    installUrl: "https://chrome.google.com/webstore/detail/lute-connect/",
  },
};

function isWalletLikelyAvailable(
  walletId: string,
  browser: ReturnType<typeof detectBrowser>
): boolean {
  const meta = WALLET_META[walletId];
  if (!meta) return true;
  if (meta.type === "mobile") return true;
  if (walletId === "lute") return browser.isChromiumBased;
  if (walletId === "kibisis") return browser.isChromiumBased || browser.isFirefox;
  return true;
}

export function WalletConnect({ className }: { className?: string }) {
  const {
    isConnected,
    address,
    displayAddress,
    balance,
    isConnecting,
    error,
    walletType,
    availableWallets,
    connect,
    disconnect,
    clearError,
  } = useWallet();
  const [showPicker, setShowPicker] = useState(false);

  const openPicker = () => {
    clearError();
    setShowPicker(true);
  };

  if (isConnecting) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn("gap-2 font-display uppercase tracking-wide", className)}
        data-testid="button-wallet-connecting"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting...
      </Button>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="destructive"
          onClick={openPicker}
          className="flex-1 gap-2 font-display uppercase tracking-wide text-xs"
          data-testid="button-wallet-error"
          title={error}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          Try Again
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearError}
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          data-testid="button-wallet-error-dismiss"
          title="Dismiss"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <>
        <Button
          onClick={openPicker}
          className={cn("gap-2 font-display uppercase tracking-wide", className)}
          data-testid="button-wallet-connect"
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </Button>
        <WalletPickerDialog
          open={showPicker}
          onOpenChange={setShowPicker}
          wallets={availableWallets}
          onSelect={(walletId) => {
            setShowPicker(false);
            connect(walletId);
          }}
        />
      </>
    );
  }

  const walletName = availableWallets.find((w) => w.id === walletType)?.name ?? walletType ?? "Wallet";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("gap-2 font-mono text-sm border-primary/30", className)}
          data-testid="button-wallet-connected"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="hidden sm:inline" data-testid="text-wallet-address">
              {displayAddress || address}
            </span>
            <Badge variant="secondary" className="font-mono text-xs" data-testid="badge-wallet-balance">
              {balance.toFixed(2)} ALGO
            </Badge>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-2">
          <p className="text-xs text-muted-foreground uppercase font-display tracking-wide">
            {walletName}
          </p>
          <p className="font-mono text-sm mt-1 break-all">{address}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-muted-foreground">
          <span className="flex items-center justify-between w-full">
            <span>Balance</span>
            <span className="font-mono">{balance.toFixed(6)} ALGO</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={disconnect}
          className="text-destructive focus:text-destructive"
          data-testid="button-wallet-disconnect"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WalletPickerDialog({
  open,
  onOpenChange,
  wallets,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: { id: string; name: string; icon: string }[];
  onSelect: (walletId: string) => void;
}) {
  const browser = useMemo(() => detectBrowser(), []);

  const browserName = browser.isSafari
    ? "Safari"
    : browser.isFirefox
    ? "Firefox"
    : browser.isChromiumBased
    ? "Chrome"
    : "your browser";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto rounded-xl pb-8">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide text-center">
            Connect Wallet
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Choose a wallet to connect to FRONTIER on Algorand Testnet
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          {wallets.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No wallets available
            </p>
          )}
          {wallets.map((wallet) => {
            const meta = WALLET_META[wallet.id];
            const available = isWalletLikelyAvailable(wallet.id, browser);
            const isMobile = meta?.type === "mobile";
            const isExtension = meta?.type === "extension";

            return (
              <div key={wallet.id} className="flex flex-col gap-1">
                <button
                  onClick={() => available && onSelect(wallet.id)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-md border border-border transition-colors text-left w-full",
                    available
                      ? "hover:bg-accent hover:border-primary/40 cursor-pointer"
                      : "opacity-50 cursor-default"
                  )}
                  data-testid={`button-connect-${wallet.id}`}
                  disabled={!available}
                  title={available ? `Connect with ${wallet.name}` : `${wallet.name} is not available in ${browserName}`}
                >
                  <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                    {wallet.icon ? (
                      <img src={wallet.icon} alt={wallet.name} className="w-8 h-8 object-contain" />
                    ) : (
                      <Wallet className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display text-sm uppercase tracking-wide">{wallet.name}</p>
                      {isMobile && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          <Smartphone className="w-2.5 h-2.5" />
                          Mobile App
                        </span>
                      )}
                      {isExtension && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          <Puzzle className="w-2.5 h-2.5" />
                          Extension
                        </span>
                      )}
                    </div>
                    {meta && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {available ? meta.description : `Not available in ${browserName}`}
                      </p>
                    )}
                  </div>
                </button>

                {isExtension && !available && meta?.installUrl && (
                  <a
                    href={meta.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-primary hover:underline px-4"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Install {wallet.name} extension
                  </a>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-4 mt-2">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            <strong>Mobile wallets</strong> (Pera, Defly) work in all browsers — scan the QR code with your phone.{" "}
            <strong>Browser extensions</strong> (Kibisis, LUTE) must be installed first.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
