export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.client && !useNuxtApp().isHydrating) await preloadBlog(String(to.params.slug))
})
