<script setup lang="ts">
import { BRAND } from '#shared/brand'

useSiteMeta({
  title: `How it works | ${BRAND.name}`,
  description: 'How Topline reads a company dataset, calculates the figures and checks every sentence against the data before a page goes live.',
  path: '/how-it-works',
})

const steps = [
  { title: 'You upload a file', body: 'Any CSV of companies works, up to 2 MB and 1,000 rows. Topline reads the column names and values to work out which column holds the company name, the ranking value, the location and so on. Nothing is tied to one industry.' },
  { title: 'You check what was found', body: 'Before anything is published you see how many rows are usable, what was fixed and which company ranks first. If a column was read wrongly, you can change it.' },
  { title: 'Topline calculates the figures', body: 'Totals, medians, shares and breakdowns are worked out in code, never by an LLM. A company with no ranking value stays in the table, marked as not disclosed, and is left out of the calculations that need that value.' },
  { title: 'An LLM writes the words', body: 'Claude Haiku writes the title, introduction, sections and FAQs from those facts. It sees the summary facts and the first 10 companies, never the whole file.' },
  { title: 'Every field is checked', body: 'A figure that does not match the data is rejected. So are links, HTML and claims about growth or trends, because one file is a single snapshot. A rejected reply gets one retry. Anything that still fails is written from a template built on the data, and the page says so.' },
  { title: 'The page goes live', body: 'The page is published straight away with a permanent address, an entry in the sitemap and the feed, and structured data for search engines.' },
]
</script>

<template>
  <div class="wrap">
    <header class="page-head">
      <h1>How it works</h1>
      <p class="lede muted">The figures come from your file. The words come from an LLM, and they are checked against those figures before anything goes live.</p>
    </header>

    <ol class="list">
      <li v-for="(step, i) in steps" :key="step.title" class="step">
        <span class="step-no">0{{ i + 1 }}</span>
        <h2>{{ step.title }}</h2>
        <p>{{ step.body }}</p>
      </li>
    </ol>

    <section class="limits band-grid">
      <h2>What the checks cannot do</h2>
      <p>The checks prove that each figure exists in your data. They cannot prove that a sentence uses it well, so read a page before you promote it. A page is also only as accurate as the file behind it.</p>
    </section>

    <div class="start actions">
      <NuxtLink to="/generate" class="btn">Generate a page</NuxtLink>
      <NuxtLink to="/blog" class="btn btn-t">See the rankings</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.list .step { grid-template-columns: 56px minmax(0, 3fr) minmax(0, 7fr); padding-block: var(--space-lg); }
.list h2 { font-size: 20px; }
.list p { max-width: 62ch; color: var(--ink); font-size: 16px; }
.limits { grid-template-columns: 56px minmax(0, 3fr) minmax(0, 7fr); gap: 20px; padding-block: 40px; }
.limits h2 { grid-column: 1 / 3; }
.limits p { max-width: 62ch; }
.start { padding-block: var(--space-xs) var(--space-xxxl); }
@media (max-width: 760px) {
  .list .step { grid-template-columns: 40px minmax(0, 1fr); }
  .limits { grid-template-columns: minmax(0, 1fr); gap: var(--space-sm); }
  .limits h2 { grid-column: auto; }
}
</style>
