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
  <div class="wrap page">
    <h1>How it works</h1>
    <p class="lede muted">The figures come from your file. The words come from an LLM, and they are checked against those figures before anything goes live.</p>

    <ol class="steps">
      <li v-for="step in steps" :key="step.title">
        <h2>{{ step.title }}</h2>
        <p>{{ step.body }}</p>
      </li>
    </ol>

    <section class="prose limits">
      <h2>What the checks cannot do</h2>
      <p>The checks prove that each figure exists in your data. They cannot prove that a sentence uses it well, so read a page before you promote it. A page is also only as accurate as the file behind it.</p>
    </section>
  </div>
</template>

<style scoped>
.page { padding-block: 64px; }
.lede { max-width: 56ch; margin-top: var(--space-md); }
.steps { margin-top: var(--space-xxl); max-width: 66ch; }
.steps li { padding-block: var(--space-lg); border-top: 1px solid var(--line); }
.steps h2 { font-size: 24px; }
.steps p { margin-top: var(--space-xs); }
.limits { margin-top: var(--space-xxl); }
.limits h2 { font-size: 24px; }
.limits p { margin-top: var(--space-xs); }
</style>
