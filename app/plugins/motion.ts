/**
 * Two small motion directives. Both do nothing on the server, nothing under
 * prefers-reduced-motion, and never move layout.
 *
 *   v-reveal      adds `is-in` when the element scrolls into view (the CSS
 *                 fades it in, and only when html.js is present).
 *   v-count       counts the number inside the element up from zero. The
 *                 final text is already rendered, so the page is complete
 *                 without JavaScript and the width is fixed before it starts.
 */
import type { Directive } from 'vue'

const reduced = () => import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let observer: IntersectionObserver | null = null
function observe(el: Element, onIn: () => void) {
  if (!('IntersectionObserver' in window)) return onIn()
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      observer?.unobserve(entry.target)
      handlers.get(entry.target)?.()
      handlers.delete(entry.target)
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 })
  handlers.set(el, onIn)
  observer.observe(el)
}
const handlers = new WeakMap<Element, () => void>()

const reveal: Directive<HTMLElement> = {
  getSSRProps: () => ({ 'data-reveal': '' }),
  created(el) {
    el.setAttribute('data-reveal', '')
  },
  mounted(el) {
    if (reduced()) {
      el.classList.add('is-in')
      return
    }
    observe(el, () => el.classList.add('is-in'))
  },
}

const NUMBER = /-?\d[\d,]*(?:\.\d+)?/

const count: Directive<HTMLElement> = {
  getSSRProps: () => ({}),
  mounted(el) {
    const final = el.textContent ?? ''
    const match = NUMBER.exec(final)
    if (!match || reduced()) return
    const target = Number(match[0].replace(/,/g, ''))
    if (!Number.isFinite(target)) return
    const decimals = (match[0].split('.')[1] ?? '').length
    const grouped = match[0].includes(',')
    const before = final.slice(0, match.index)
    const after = final.slice(match.index + match[0].length)
    // Fix the width first so the digits can change without moving anything.
    el.style.display = 'inline-block'
    el.style.minWidth = `${el.getBoundingClientRect().width}px`
    const format = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped })
    observe(el, () => {
      const duration = 1100
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        el.textContent = `${before}${format(target * eased)}${after}`
        if (t < 1) requestAnimationFrame(tick)
        else el.textContent = final
      }
      requestAnimationFrame(tick)
    })
  },
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', reveal)
  nuxtApp.vueApp.directive('count', count)
  if (import.meta.client) document.documentElement.classList.add('ready')
})
