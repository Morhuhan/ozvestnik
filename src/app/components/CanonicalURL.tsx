'use client'

import { useEffect } from 'react'

export default function CanonicalURL() {
  useEffect(() => {
    const canonicalDomain = 'озерский-вестник.рф'
    
    if (window.location.host.includes('xn--')) {
      const newUrl = window.location.href.replace(window.location.host, canonicalDomain)
      window.history.replaceState(null, '', newUrl)
    }

    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection()?.toString()
      if (!selection && window.location.host.includes('xn--')) {
        e.preventDefault()
        const url = window.location.href.replace(window.location.host, canonicalDomain)
        e.clipboardData?.setData('text/plain', url)
      }
    }

    document.addEventListener('copy', handleCopy)
    return () => document.removeEventListener('copy', handleCopy)
  }, [])

  return null
}