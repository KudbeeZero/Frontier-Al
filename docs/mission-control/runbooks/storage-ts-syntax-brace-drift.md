# Runbook: server/storage.ts syntax error (brace drift)

## Symptoms
- Server won't start
- TypeScript parser error points near a line inside a large nested block (often AI logic)

## Most common cause
- Unmatched braces due to nested if/for blocks
- Bad search/replace old_string match causing abrupt termination or extra `}`

## Confirm
```bash
npx -y tsc -p tsconfig.json --noEmit
nl -ba server/storage.ts | sed -n '3080,3185p'
git diff -- server/storage.ts
python3 - <<'PY'
import re
p="server/storage.ts"
start,end=3080,3185
lines=open(p,"r",encoding="utf-8",errors="ignore").read().splitlines()
chunk="\n".join(lines[start-1:end])
chunk=re.sub(r'//.*','',chunk)
chunk=re.sub(r'/\*.*?\*/','',chunk,flags=re.S)
chunk=re.sub(r'(["\']).*?\1','""',chunk)
bal=0; minbal=0
for ch in chunk:
    if ch=="{": bal+=1
    elif ch=="}": bal-=1; minbal=min(minbal,bal)
print("brace_balance_end:", bal)
print("brace_balance_min:", minbal)
PY

## 4) Create an incident record placeholder for THIS exact issue (so you can fill it as you go)
```bash
cat > docs/mission-control/incidents/2026-02-25_storage-ts_syntax-error.md <<'MD'
# Incident: server/storage.ts syntax error after edit (line ~3128/3159)

## What happened
- After last edit call, server failed to start
- Logs indicated syntax error around line ~3128/3159
- Suspected cause: brace drift in KRONOS nested blocks or incorrect old_string replacement

## Evidence (paste outputs)
- `tsc --noEmit` output:
- `nl -ba` snippet:
- `git diff` snippet:

## Root cause
(TBD)

## Fix applied
(TBD)

## Follow-up
- Refactor KRONOS AI logic out of storage.ts
- Add CI check: `tsc --noEmit`
