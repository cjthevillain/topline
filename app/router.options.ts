import type { RouterConfig } from 'nuxt/schema'

/**
 * Scrolls as soon as the new page exists, instead of a frame later, so the
 * browser captures the new page at its final position for the page change.
 */
export default <RouterConfig>{
  scrollBehavior(to, from, saved) {
    const position = () => saved ?? (to.hash ? { el: to.hash } : { left: 0, top: 0 })
    if (to.path === from.path) return to.hash ? { el: to.hash } : false
    if (!from.matched.length) return position()
    return new Promise(resolve => useNuxtApp().hooks.hookOnce('page:finish', () => resolve(position())))
  },
}
