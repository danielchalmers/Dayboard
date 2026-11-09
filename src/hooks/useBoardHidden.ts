import { useCallback, useEffect, useState } from "react"

import { readBoardHidden, watchBoardHidden, writeBoardHidden } from "~/lib/hidden"

// Whether the board is hidden, read before the first paint so a hidden board never shows its cards on the way in, and kept in step with the other board tabs on this device.
export const useBoardHidden = (): [boolean, (hidden: boolean) => void] => {
  const [hidden, setHidden] = useState(readBoardHidden)

  useEffect(() => watchBoardHidden(setHidden), [])

  const change = useCallback((next: boolean) => {
    setHidden(next)
    writeBoardHidden(next)
  }, [])

  return [hidden, change]
}
