# Topline

Topline turns a CSV of companies into an SEO-optimised, server-rendered blog page. It is built in Nuxt. Upload a dataset from any industry and it cleans the data, calculates the statistics, asks an LLM to write the copy, checks that copy against the data, and publishes a new page with no code change and no rebuild.

- **Live demo:** to be added after deployment
- **Example page:** `/blog/top-100-uk-seed-stage-fintech-companies-by-total-raised`

## What it does

| Stage | What happens | Where |
| --- | --- | --- |
| Read | Decodes UTF-8, UTF-16 and Windows-1252. Finds the delimiter and header row. Repairs stray quotes and unquoted numbers. | `shared/pipeline/decode.ts`, `csv.ts` |
| Understand | Profiles each column and assigns a role (name, ranking value, location, sector and so on) from its header and values. The person uploading can override any role. | `shared/pipeline/schema.ts` |
| Clean | Removes totals, footnotes, duplicates and rows with no name. Keeps rows with missing values and lists them last. Reports every change with line numbers. | `shared/pipeline/clean.ts` |
| Analyse | Calculates every statistic and breakdown in code, with nothing specific to one industry. | `shared/pipeline/stats.ts` |
| Write | Sends only computed facts and a short sample to an LLM. | `shared/copy/prompt.ts`, `generate.ts` |
| Check | Treats the reply as untrusted. Rejects figures the data cannot support, trend claims, HTML and links, field by field. | `shared/copy/validate.ts`, `grounding.ts` |
| Publish | Stores the document and renders it through one Nuxt template, with metadata, JSON-LD and a sitemap entry. | `server/`, `app/pages/blog/[slug].vue` |

## Architecture

```
CSV upload ──> data layer ──> insights ──> copy layer ──> stored document ──> Nuxt template
              (shared/pipeline)            (shared/copy)   (server/utils)      (app/)
                                    LLM provider chain
                                    └─> data template if every provider fails
```

Dataset, insights, copy and provenance are separate parts of one stored JSON document. The page template knows nothing about any industry, so a change to the design applies to every page, and copy can be regenerated without touching the data.

The same analysis code runs in the browser for the instant preview and on the server for the real upload. The server never trusts the preview.

### Key decisions

- **Numbers come from code, words come from the LLM.** The model never calculates anything. A figure in its reply must match a value computed from the data, at the precision it is quoted.
- **The upload cannot fail because of the LLM.** Providers are tried in order. A field that fails its checks is replaced by the matching field from a deterministic template, and the page says which path it took.
- **No secrets in the browser.** LLM calls happen on the server, and keys come from environment variables.
- **One brand file.** The product name and tagline live in `shared/brand.ts`, and every page, the JSON-LD and the manifest read from it.
- **Design tokens drive both themes.** `design/tokens.json` holds the light values and the dark overrides. `pnpm tokens` writes `app/assets/css/tokens.css`. The theme toggle in the header remembers the choice, light is the default, and the inline script in `app/app.vue` applies it before the first paint.
- **Motion never hides content.** Scroll reveals and counting numbers only run when JavaScript is on and the visitor has not asked for reduced motion. The HTML is complete without them.
- **Claude Haiku 5.5 writes the copy.** It is fast, costs under a tenth of a cent per page, and the API enforces the JSON shape of the reply. It runs at low effort, and a refusal or an error moves on to the next provider.
- **Gemini is optional, not the default.** Google's Gemini API terms say services offered to users in the UK, EEA or Switzerland must use paid quota, so the free tier cannot serve this site.

## Tools used

Nuxt 4, Vue 3, TypeScript, Papa Parse, Vitest, Playwright, Vercel Blob (uploads in production), and Claude Haiku 5.5 through the Anthropic SDK. Groq, Ollama and Gemini also work as providers.

## Run it locally

Requires Node 22 or later and pnpm.

```bash
pnpm install
pnpm dev
```

The app works with no configuration. With no LLM set, copy comes from the data template. To use an LLM, copy `.env.example` to `.env` and set a key or a model:

```bash
# Claude
NUXT_ANTHROPIC_API_KEY=your-key

# Or Groq
NUXT_LLM_API_KEY=your-key
NUXT_LLM_MODEL=your-model

# Or a local Ollama, with no key
NUXT_LLM_NAME=ollama
NUXT_LLM_BASE_URL=http://127.0.0.1:11434/v1
NUXT_LLM_MODEL=llama3.2:3b
```

Uploaded pages are saved in `.data/blogs`.

## Configuration

All settings are optional. See `.env.example`.

| Variable | Purpose | Default |
| --- | --- | --- |
| `NUXT_ANTHROPIC_API_KEY` | Turns on Claude, tried first | off |
| `NUXT_ANTHROPIC_MODEL` | Claude model | `claude-haiku-5-5` |
| `NUXT_LLM_MODEL` | Turns on the OpenAI-compatible provider | off |
| `NUXT_LLM_BASE_URL`, `NUXT_LLM_API_KEY`, `NUXT_LLM_NAME` | Provider details | Groq |
| `NUXT_GEMINI_API_KEY`, `NUXT_GEMINI_MODEL` | Adds Gemini to the chain | off |
| `NUXT_LLM_TIMEOUT_MS`, `NUXT_LLM_BUDGET_MS` | Limit per call, and for all calls together | 25000, 50000 |
| `NUXT_DAILY_PAGE_LIMIT`, `NUXT_IP_DAILY_LIMIT` | Daily caps on the public upload | 100, 20 |
| `NUXT_PUBLIC_SITE_URL` | Canonical origin | request origin |

## Tests

```bash
pnpm test        # unit tests
pnpm build
pnpm test:e2e    # browser and HTTP tests against the production build, with a mock LLM
pnpm typecheck
```

`tests/fixtures` holds made-up CSVs with different columns, delimiters, encodings, missing values and bad rows, plus a hostile file that tries script injection and prompt injection.

## Deploying

Designed for Vercel's free Hobby plan, which detects Nuxt with no build configuration:

1. Import the repository.
2. Create a Blob store in the project, which sets `BLOB_READ_WRITE_TOKEN`.
3. Add the LLM variables as server-side environment variables.

To change the seeded pages, set the LLM variables and run `pnpm seed`.

## Limitations

- The checks confirm that each figure exists in the data. They cannot prove that a sentence uses it correctly.
- The trend filter is a list of phrases, so it reduces unsupported claims but cannot remove them all.
- Quota counters are read and then written, so they are a soft limit.
- Files are limited to 2 MB and 1,000 rows.
- Anyone can publish on the public demo, within the daily caps. A real deployment should add sign-in and an editorial review step before pages are indexed.
- Every page shares one Open Graph image. Per-page images would improve social sharing.
