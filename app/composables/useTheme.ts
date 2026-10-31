import { BRAND } from '#shared/brand'

export type Theme = 'light' | 'dark'

const KEY = `${BRAND.name.toLowerCase()}-theme`

/**
 * The colour theme. Light by default; the choice is remembered in localStorage
 * and restored by the inline script in app.vue before the first paint.
 */
export function useTheme() {
  const theme = useState<Theme>('theme', () => 'light')

  onMounted(() => {
    theme.value = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  })

  function set(next: Theme) {
    theme.value = next
    const root = document.documentElement
    if (next === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
    try {
      localStorage.setItem(KEY, next)
    }
    catch {
      // Private mode or storage off: the choice lasts for this page only.
    }
  }

  const toggle = () => set(theme.value === 'dark' ? 'light' : 'dark')

  return { theme, set, toggle }
}
