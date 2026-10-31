const KEY = 'topline-removal-tokens'

function read(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>
  }
  catch {
    return {}
  }
}

/** Kept in this browser only. It is what proves someone published a page. */
export function saveRemovalToken(slug: string, token: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [slug]: token }))
  }
  catch {
    // Private browsing can refuse storage. The page still publishes.
  }
}

export function loadRemovalToken(slug: string): string | null {
  return read()[slug] ?? null
}

export function forgetRemovalToken(slug: string) {
  const { [slug]: _gone, ...rest } = read()
  localStorage.setItem(KEY, JSON.stringify(rest))
}
