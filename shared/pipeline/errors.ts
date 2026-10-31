import type { PipelineError } from '../types/blog'

export const LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxRows: 1000,
  maxColumns: 60,
  minRows: 3,
  warningLines: 20,
}

/** Thrown for a file we cannot use. The message goes straight to the person uploading. */
export class PipelineFailure extends Error implements PipelineError {
  code: string
  hint: string

  constructor(code: string, message: string, hint: string) {
    super(message)
    this.name = 'PipelineFailure'
    this.code = code
    this.hint = hint
  }
}
