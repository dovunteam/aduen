import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    userSubject?: string
  }
}
