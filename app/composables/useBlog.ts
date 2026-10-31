import type { BlogDocument } from '#shared/types/blog'

const url = (slug: string) => `/api/blogs/${slug}`
const keyFor = (slug: string) => `blog:${slug}`

/** A published ranking. A stored page never changes, so one load lasts the visit. */
export function useBlog(slug: string) {
  return useFetch<BlogDocument>(url(slug), {
    key: keyFor(slug),
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key],
  })
}

/**
 * Loads a ranking before the page change starts. The browser freezes the page
 * during a view transition, so waiting first keeps the old page usable.
 */
export async function preloadBlog(slug: string) {
  const { payload } = useNuxtApp()
  const key = keyFor(slug)
  if (payload.data[key]) return
  payload.data[key] = await $fetch<BlogDocument>(url(slug)).catch(() => undefined)
}
