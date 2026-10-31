/** Waits a moment first, so a fast page change shows no loading line at all. */
export default defineNuxtPlugin(() => {
  const navigating = useNavigating()
  const router = useRouter()
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    clearTimeout(timer)
    navigating.value = false
  }
  router.beforeEach((to, from) => {
    if (to.path !== from.path) timer = setTimeout(() => (navigating.value = true), 150)
  })
  router.afterEach(stop)
  router.onError(stop)
})
