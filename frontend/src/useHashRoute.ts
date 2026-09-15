import { useSyncExternalStore } from 'react'

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}
const read = () => window.location.hash.replace(/^#/, '') || '/'

export const useHashRoute = () => useSyncExternalStore(subscribe, read, () => '/')
