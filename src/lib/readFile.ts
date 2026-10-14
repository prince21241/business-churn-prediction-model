export function readFileText(
  file: File,
  onProgress: (value: number) => void,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('The upload was cancelled.', 'AbortError'))
      return
    }
    const reader = new FileReader()
    const abort = () => {
      reader.abort()
      reject(new DOMException('The upload was cancelled.', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    reader.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    reader.onload = () => {
      signal.removeEventListener('abort', abort)
      onProgress(100)
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => {
      signal.removeEventListener('abort', abort)
      reject(new Error('The file could not be read.'))
    }
    reader.readAsText(file)
  })
}
