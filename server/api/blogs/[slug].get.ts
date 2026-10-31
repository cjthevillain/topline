export default defineEventHandler(async (event) => {
  const blog = await getBlog(getRouterParam(event, 'slug') ?? '')
  if (!blog) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  return blog
})
