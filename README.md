# Topline

Topline turns a CSV of companies into an SEO-optimised, server-rendered blog page. It is built in Nuxt. Upload a dataset from any industry and it cleans the data, calculates the statistics, asks an LLM to write the copy, checks that copy against the data, and publishes a new page with no code change and no rebuild.

- **Live demo:** https://topline.cjv.app
- **Example page:** https://topline.cjv.app/blog/top-100-uk-seed-stage-fintech-companies-by-total-raised

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
- **Design tokens drive both themes.** `design/tokens.json` holds the light values and the dark overrides. `pnpm tokens` writes `app/assets/css/tokens.css`. The theme toggle in the footer remembers the choice, light is the default, and the inline script in `app/app.vue` applies it before the first paint.
- **Motion explains a change of page and does nothing else.** Page changes use the browser's View Transitions API through Nuxt, with no animation library. The header stays still and a ranking's title and figure move from the list to their place on the page. Ranking data loads before the transition starts, because the browser freezes the page during one. Visitors who ask for reduced motion get a plain crossfade. There are no scroll reveals, so the HTML is complete without JavaScript.
- **Claude Haiku 5.5 writes the copy.** It is fast, costs under a tenth of a cent per page, and the API enforces the JSON shape of the reply. It runs at low effort, and a refusal or an error moves on to the next provider.
- **Gemini is optional, not the default.** Google's Gemini API terms say services offered to users in the UK, EEA or Switzerland must use paid quota, so the free tier cannot serve this site.

## Production details

- **Metadata.** Every page sets its title, description, canonical address, Open Graph and Twitter tags. Ranking pages add BlogPosting, Dataset, ItemList, BreadcrumbList and FAQPage structured data. The site serves `sitemap.xml`, `robots.txt`, `feed.xml` and `llms.txt`.
- **Brand files.** The logo is one set of paths in `shared/logo.ts`. `pnpm brand` draws the favicons, app icons, maskable icon and default social image from it, and `public/site.webmanifest` lists them.
- **Social images.** `/og/<slug>.png` draws a 1200 by 630 card for each page with its title and headline figure. The image is stored after the first request, removed with its page, and replaced by `/og.png` if drawing fails.
- **Security.** A Content Security Policy with a new nonce on every response, plus HSTS and the usual browser headers, set in `server/plugins/security.ts`. Spreadsheet formulas are neutralised in CSV downloads. `/.well-known/security.txt` gives a contact.
- **Removal.** Publishing returns a private token, kept in the browser, that lets the person who uploaded a page remove it. Every page also has a link to report it.
- **Legal pages.** `/privacy` and `/terms` describe what the site really stores and which providers see data.
- **Analytics.** Optional. Set the two Umami variables to load a cookie-free script. It is off by default and the Content Security Policy only allows that origin when it is set.

## Tools used

Nuxt 4, Vue 3, TypeScript, Papa Parse, Satori and resvg (social images), Vitest, Playwright, Docker, Coolify, and Claude Haiku 5.5 through the Anthropic SDK. Groq, Ollama and Gemini also work as providers. The typeface is Archivo, under the SIL Open Font License, served from this site.

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
| `NUXT_PUBLIC_UMAMI_ORIGIN`, `NUXT_PUBLIC_UMAMI_WEBSITE_ID` | Turns on Umami analytics | off |

## Tests

```bash
pnpm test        # unit tests
pnpm build
pnpm test:e2e    # browser and HTTP tests against the production build, with a mock LLM
pnpm typecheck
```

`tests/fixtures` holds made-up CSVs with different columns, delimiters, encodings, missing values and bad rows, plus a hostile file that tries script injection and prompt injection.

## Deploying

The live site runs on a self-hosted Coolify server, built from the `Dockerfile`. To run your own copy:

1. Create an application from this repository with the Dockerfile build pack and port 3000.
2. Mount a volume at `/app/.data`, where uploaded pages and quota counters are stored.
3. Set `NUXT_PUBLIC_SITE_URL` and the LLM variables as runtime variables. Do not mark them as build variables, or the key ends up in the image.
4. Use `/api/health` as the health check.

To add seeded pages, set the LLM variables and run `pnpm seed`. Existing pages are kept unless you add `--force`, which rewrites their copy with new model calls.

After changing the logo run `pnpm brand`. After changing `design/tokens.json` run `pnpm tokens`.

## Limitations

- The checks confirm that each figure exists in the data. They cannot prove that a sentence uses it correctly.
- The trend filter is a list of phrases, so it reduces unsupported claims but cannot remove them all.
- Quota counters are read and then written, so they are a soft limit.
- Files are limited to 2 MB and 1,000 rows.
- Anyone can publish on the public demo, within the daily caps. A real deployment should add sign-in and an editorial review step before pages are indexed.
- The privacy and terms pages are a draft and have not had legal review.
- Older browsers without the View Transitions API change page instantly. Nothing else is lost.
