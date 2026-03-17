import { Wallet, LogOut, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";
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
import { useState } from "react";

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
      <div className="flex items-center gap-1">
        <Button
          variant="destructive"
          onClick={openPicker}
          className={cn("gap-2 font-display uppercase tracking-wide text-xs", className)}
          data-testid="button-wallet-error"
          title={error}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          Retry
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearError}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide text-center">
            Connect Wallet
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Choose a wallet to connect to FRONTIER
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          {wallets.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No wallets available
            </p>
          )}
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => onSelect(wallet.id)}
              className="flex items-center gap-4 p-4 rounded-md border border-border hover-elevate transition-colors text-left w-full"
              data-testid={`button-connect-${wallet.id}`}
            >
              <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                {wallet.icon ? (
                  <img src={wallet.icon} alt={wallet.name} className="w-8 h-8 object-contain" />
                ) : (
                  <Wallet className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-display text-sm uppercase tracking-wide">{wallet.name}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
