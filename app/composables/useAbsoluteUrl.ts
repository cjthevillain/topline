/** The canonical origin: the configured site URL, or the origin of this request. */
export function useSiteOrigin(): string {
  const configured = useRuntimeConfig().public.siteUrl
  return (configured || useRequestURL().origin).replace(/\/$/, '')
}
