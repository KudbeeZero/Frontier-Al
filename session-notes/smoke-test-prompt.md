# Smoke Test Prompt

Copy and paste the block below into Claude to smoke test recent changes.

---

```
Smoke test the most recently changed files in this repo.

Step 1 — Identify changed files:
Run: git diff HEAD~1 --name-only
List every changed file.

Step 2 — TypeScript check:
Run: npm run check
If there are errors, list each one with file:line. Stop if any are critical.

Step 3 — Build:
Run: npm run build
If the build fails, report the full error and stop.

Step 4 — Review each changed file and check for these issues:

WalletContext.tsx / walletManager.ts:
- WalletManager is created before WalletProvider renders
- activeAddress and activeAccount have null checks everywhere they're used
- connect() catches errors including user-cancellation (modal closed)
- disconnect() clears all state
- useEffect hooks have cleanup/return functions (no memory leaks)
- signTransactions result array filters out null entries safely

WalletConnect.tsx:
- balance.toFixed() is protected against null or undefined balance
- Wallet picker renders gracefully if wallets array is empty
- Error state has a retry button
- Connecting state shows a spinner during async connect()

algorand.ts:
- signTransactionWithActiveWallet() throws a clear error if no signer is registered
- getAccountBalance() handles network failures without crashing
- Batch queue does not re-queue actions indefinitely on non-cancellation failures
- algodClient and indexerClient point to the correct network endpoints

App.tsx:
- WalletProvider wraps the full app component tree
- WalletManager is passed as the `manager` prop to WalletProvider
- There are no duplicate WalletProvider wrappers

Step 5 — Report results as a table:

| Check            | Result | Notes |
|------------------|--------|-------|
| TypeScript       | ✅/❌  |       |
| Build            | ✅/❌  |       |
| WalletContext    | ✅/❌  |       |
| WalletConnect UI | ✅/❌  |       |
| algorand.ts      | ✅/❌  |       |
| App.tsx          | ✅/❌  |       |

End with either "Smoke test passed." or a list of specific issues with file:line references.
```
