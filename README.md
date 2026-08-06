# JB Simulator

Browser-based **JBasic / InfoBASIC** learning lab with a **TAFJ-style compile → catalogue → run** flow.

> This is an educational simulator. It is **not** licensed Temenos TAFJ. Runtime behaviour and messages are modeled after jBASE / InfoBASIC docs and common TAFJ compile UX so you can practice safely for free.

## Features

- Monaco editor with JBasic syntax highlighting
- Create / edit / delete `.b` programs under `BP/`
- Automatic browser storage: edited and newly created files survive page refreshes
- **Docs** tab: JBC1 topics in **topic groups** + a **Newcomer path** (step-by-step). Unsupported items stay visible for learning; runnable ones have Open & Run.
- **Compile** logs (`tCompile`-style), error panel with line numbers
- **Run** with CRT/PRINT terminal output
- In-memory VFS (`OPEN` / `READ` / `WRITE`) with demo `F.CUSTOMER` data
- Lessons covering basics, arrays, control flow, files, GOSUB, and T24-style subroutines
- `$INSERT I_COMMON` / `I_EQUATE` stubs

## Quick start

```bash
cd "/Users/mnaeem.paracha/development/JB Simulator"
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Deploy

Both **Vercel** and **GitHub Pages** work with this app (`base: './'` is already set).

| | Vercel | GitHub Pages |
|---|---|---|
| Setup | Easiest (import repo → Deploy) | Enable Pages + Actions (workflow included) |
| URL | `*.vercel.app` (custom domain free) | `username.github.io/repo-name` |
| Previews | Yes (per PR) | No (unless extra workflow) |
| Best for | Day-to-day deploys | Keeping everything on GitHub |

**Recommendation:** use **Vercel** for convenience. Use **GitHub Pages** if you want zero extra accounts.

### Vercel

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import the repo
3. Framework: Vite (auto-detected) → Deploy

Or CLI:

```bash
npx vercel
```

### GitHub Pages

1. Push to GitHub on `main`
2. Repo **Settings → Pages → Source: GitHub Actions**
3. The workflow `.github/workflows/deploy-pages.yml` builds and publishes `dist/`
4. Site URL will be like `https://<user>.github.io/JB-Simulator/`

## Docs used

- Your PDFs (extracted under `docs-extracted/` for engine reference)
- [jBASE @ function / man pages](https://static.zumasys.com/jbase/r99/knowledgebase/manuals/3.0/30manpages/man/jbc2_@.htm)

## Language coverage (MVP)

| Area | Support |
|------|---------|
| PROGRAM / SUBROUTINE / END | Yes |
| CRT, PRINT, assignment, `:` concat | Yes |
| IF / THEN / ELSE / END, END ELSE | Yes |
| FOR / NEXT, LOOP / WHILE / UNTIL / REPEAT | Yes |
| GOSUB / GOTO / RETURN / CALL | Yes |
| Dynamic arrays `<>` , FM/VM/SM | Yes |
| OPEN READ WRITE DELETE CLOSE | Yes (VFS) |
| EQUATE, COMMON, $INSERT | Yes (stubs) |
| Builtins LEN NUM INT CHAR FIELD DCOUNT DATE TIME OCONV… | Yes |
| Full T24 APIs / real JDBC / real tCompile | No (simulated) |

## Suggested learning path

1. Open **Lessons** → complete 1–7 in order  
2. Break `BP/ERRORS.DEMO.b` and read Compile errors  
3. Change `ID.NEW` and re-run `V.AUT.CNT`  
4. Create your own program with **New**

## Honesty note on “match TAFJ errors”

Without a Temenos license we **cannot** emit byte-for-byte official TAFJ diagnostics. This lab uses a close, consistent schema:

```text
[INFO] tCompile BP/HELLO.b
[INFO] Analyzing HELLO.b ...
[ERROR] BP/HELLO.b:12: [TAFJ-BLOCK] 'ELSE' without matching 'IF'
[ERROR] Compilation failed with 1 error(s)
```

If you later get access to real TAFJ logs, we can tune messages to match your site’s compiler output.
