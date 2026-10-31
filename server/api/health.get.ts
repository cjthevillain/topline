/** The container health check. Reading storage proves the volume is mounted, not just that Node is up. */
export default defineEventHandler(async () => {
  await useStorage('blogs').getKeys('quota:0000')
  return { ok: true }
})
