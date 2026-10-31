/** True while the next page takes longer than a moment to load. The header shows it. */
export const useNavigating = () => useState('navigating', () => false)

/** The ranking whose title and figure travel across the next page change. */
export const useHandOff = () => useState<string | null>('hand-off', () => null)
