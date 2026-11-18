import { z } from 'zod'

/**
 * Validates a server-function argument. Server-function arguments are
 * client-controlled JSON, so TypeScript's types don't protect us at runtime.
 *
 * Throws a plain `Error` rather than letting a `ZodError` escape: a ZodError
 * carries function-valued properties that the server-function transport can't
 * encode, so the client would get an opaque "could not be encoded" failure
 * instead of a readable message.
 */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error(`Invalid input: ${z.prettifyError(result.error)}`)
  return result.data
}
