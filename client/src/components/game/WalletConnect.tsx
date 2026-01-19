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
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

export function WalletConnect({ className }: { className?: string }) {
  const { isConnected, address, displayAddress, balance, isConnecting, error, connect, disconnect } = useWallet();

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
        onClick={connect}
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
      <Button
        onClick={connect}
        className={cn("gap-2 font-display uppercase tracking-wide", className)}
        data-testid="button-wallet-connect"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2 font-mono text-sm border-primary/30 hover:border-primary/50",
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
            Connected Wallet
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
