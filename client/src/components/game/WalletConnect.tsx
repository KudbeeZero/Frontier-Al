import { Wallet, LogOut, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
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
  const { isConnected, address, displayAddress, balance, isConnecting, error, walletType, connectPera, connectLute, disconnect } = useWallet();
  const [showPicker, setShowPicker] = useState(false);

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
      <Button
        variant="destructive"
        onClick={() => setShowPicker(true)}
        className={cn("gap-2 font-display uppercase tracking-wide", className)}
        data-testid="button-wallet-error"
      >
        <AlertCircle className="w-4 h-4" />
        Retry Connection
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <>
        <Button
          onClick={() => setShowPicker(true)}
          className={cn("gap-2 font-display uppercase tracking-wide", className)}
          data-testid="button-wallet-connect"
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </Button>
        <WalletPickerDialog
          open={showPicker}
          onOpenChange={setShowPicker}
          onSelectPera={() => { setShowPicker(false); connectPera(); }}
          onSelectLute={() => { setShowPicker(false); connectLute(); }}
        />
      </>
    );
  }

  const walletLabel = walletType === "lute" ? "LUTE" : "Pera";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2 font-mono text-sm border-primary/30",
            className
          )}
          data-testid="button-wallet-connected"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="hidden sm:inline" data-testid="text-wallet-address">{displayAddress || address}</span>
            <Badge variant="secondary" className="font-mono text-xs" data-testid="badge-wallet-balance">
              {balance.toFixed(2)} ALGO
            </Badge>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-2">
          <p className="text-xs text-muted-foreground uppercase font-display tracking-wide">
            {walletLabel} Wallet
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
  onSelectPera,
  onSelectLute,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPera: () => void;
  onSelectLute: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide text-center">
            Connect Wallet
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Choose a wallet to connect to FRONTIER
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <button
            onClick={onSelectPera}
            className="flex items-center gap-4 p-4 rounded-md border border-border hover-elevate transition-colors"
            data-testid="button-connect-pera"
          >
            <div className="w-10 h-10 rounded-md bg-[#ffee55] flex items-center justify-center shrink-0">
              <span className="text-black font-bold text-lg">P</span>
            </div>
            <div className="text-left">
              <p className="font-display text-sm uppercase tracking-wide">Pera Wallet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Mobile & Web wallet for Algorand</p>
            </div>
          </button>
          <button
            onClick={onSelectLute}
            className="flex items-center gap-4 p-4 rounded-md border border-border hover-elevate transition-colors"
            data-testid="button-connect-lute"
          >
            <div className="w-10 h-10 rounded-md bg-[#6366f1] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <div className="text-left">
              <p className="font-display text-sm uppercase tracking-wide">LUTE Wallet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Browser-based Algorand wallet</p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
