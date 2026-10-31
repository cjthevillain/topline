/** Lets the person who published a page take it down, using the token they were given. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: unknown }>(event)
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!await removeBlog(getRouterParam(event, 'slug') ?? '', token)) {
    throw createError({ statusCode: 403, statusMessage: 'This page cannot be removed with that token.' })
  }
  setResponseStatus(event, 204)
  return null
})
