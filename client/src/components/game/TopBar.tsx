import { Settings, Sun, Moon, HelpCircle, Menu } from "lucide-react";
import { SiTelegram, SiX, SiGithub, SiDiscord } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { WalletConnect } from "./WalletConnect";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface TopBarProps {
  isConnected: boolean;
  className?: string;
  mobileMenuContent?: React.ReactNode;
}

export function TopBar({ isConnected, className, mobileMenuContent }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex items-center justify-between gap-4 px-4 py-2 backdrop-blur-md bg-black/50 border-b border-white/10",
        className
      )}
      data-testid="top-bar"
    >
      <div className="flex items-center gap-4">
        {mobileMenuContent && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" data-testid="button-mobile-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <VisuallyHidden>
                <SheetTitle>Game Menu</SheetTitle>
                <SheetDescription>Base information and game controls</SheetDescription>
              </VisuallyHidden>
              {mobileMenuContent}
            </SheetContent>
          </Sheet>
        )}

        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center border border-primary/30">
              <span className="font-display text-xl font-bold text-primary">F</span>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-success border-2 border-background animate-pulse" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-display text-xl font-bold uppercase tracking-wider">FRONTIER</h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                TESTNET
              </Badge>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">V1.1</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <div className="hidden sm:flex items-center gap-1 mr-1 border-r border-border pr-2">
          <a href="https://t.me/frontier_game" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" data-testid="link-telegram">
              <SiTelegram className="w-4 h-4" />
            </Button>
          </a>
          <a href="https://x.com/frontier_game" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" data-testid="link-twitter">
              <SiX className="w-4 h-4" />
            </Button>
          </a>
          <a href="https://github.com/frontier-game" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" data-testid="link-github">
              <SiGithub className="w-4 h-4" />
            </Button>
          </a>
          <a href="https://discord.gg/frontier" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" data-testid="link-discord">
              <SiDiscord className="w-4 h-4" />
            </Button>
          </a>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="hidden sm:flex"
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        <Button variant="ghost" size="icon" className="hidden sm:flex" data-testid="button-help">
          <HelpCircle className="w-5 h-5" />
        </Button>

        <Button variant="ghost" size="icon" className="hidden sm:flex" data-testid="button-settings">
          <Settings className="w-5 h-5" />
        </Button>

        <WalletConnect />
      </div>
    </header>
  );
}
