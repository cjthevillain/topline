import { LIMITS, PipelineFailure } from './errors'

/**
 * Turns uploaded bytes into text. Excel's "CSV" export on Windows is
 * Windows-1252, where `£` is a single byte that is invalid UTF-8, so a strict
 * UTF-8 decode comes first and Windows-1252 is the fallback.
 */
export function decodeBytes(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    throw new PipelineFailure('empty_file', 'This file is empty.', 'Choose a CSV file that has a header row and at least a few rows of data.')
  }
  if (bytes.length > LIMITS.maxBytes) {
    throw new PipelineFailure(
      'file_too_large',
      `This file is ${(bytes.length / 1024 / 1024).toFixed(1)} MB. The limit is ${LIMITS.maxBytes / 1024 / 1024} MB.`,
      'Remove columns you do not need, or split the file.',
    )
  }
  rejectBinary(bytes)

  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  const body = bytes.subarray(start)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body)
  }
  catch {
    return new TextDecoder('windows-1252').decode(body)
  }
}

function rejectBinary(bytes: Uint8Array): void {
  const head = String.fromCharCode(...bytes.subarray(0, 8))
  if (head.startsWith('PK\u0003\u0004') || head.startsWith('ÐÏ\u0011à')) {
    throw new PipelineFailure('excel_file', 'This looks like an Excel workbook, not a CSV file.', 'In Excel, use File, Save As, and choose CSV UTF-8.')
  }
  if (head.startsWith('%PDF')) {
    throw new PipelineFailure('pdf_file', 'This is a PDF, not a CSV file.', 'Export the data as CSV and upload that instead.')
  }
  const isUtf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)
  if (!isUtf16 && bytes.subarray(0, 4096).includes(0)) {
    throw new PipelineFailure('binary_file', 'This does not look like a text file.', 'Upload a plain CSV file with a header row.')
  }
}
