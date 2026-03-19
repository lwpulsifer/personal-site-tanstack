import { useEffect } from 'react'

/** Revokes a blob: URL when it changes or the component unmounts. */
export function useRevokeObjectUrl(url: string | null) {
  useEffect(() => {
    return () => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [url])
}
