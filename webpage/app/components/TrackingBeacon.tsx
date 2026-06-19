'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function TrackingBeacon() {
  const pathname = usePathname()
  const lastTracked = useRef('')
  const sessionIdRef = useRef<string | null>(null)
  const pageStartRef = useRef(0)

  // Track page view
  useEffect(() => {
    if (pathname === lastTracked.current) return
    if (pathname.startsWith('/admin')) return

    // Send duration for previous page
    if (lastTracked.current && sessionIdRef.current) {
      const duration = Math.round((Date.now() - pageStartRef.current) / 1000)
      if (duration > 2) {
        navigator.sendBeacon('/api/tracking', JSON.stringify({
          type: 'duration',
          page: lastTracked.current,
          sessionId: sessionIdRef.current,
          duration,
        }))
      }
    }

    lastTracked.current = pathname
    pageStartRef.current = Date.now()

    fetch('/api/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: pathname,
        referrer: document.referrer,
        sessionId: sessionIdRef.current,
      }),
    })
      .then(r => r.json())
      .then((d: { sessionId?: string }) => { if (d.sessionId) sessionIdRef.current = d.sessionId })
      .catch(() => {})
  }, [pathname])

  // Send duration on page hide
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && lastTracked.current && sessionIdRef.current) {
        const duration = Math.round((Date.now() - pageStartRef.current) / 1000)
        if (duration > 2) {
          navigator.sendBeacon('/api/tracking', JSON.stringify({
            type: 'duration',
            page: lastTracked.current,
            sessionId: sessionIdRef.current,
            duration,
          }))
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Presence heartbeat — lets the admin live map show connects/disconnects
  useEffect(() => {
    const beat = () => {
      if (!sessionIdRef.current || document.visibilityState === 'hidden') return
      fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'heartbeat', page: lastTracked.current || '/', sessionId: sessionIdRef.current }),
        keepalive: true,
      }).catch(() => {})
    }
    const id = setInterval(beat, 15_000)

    const onVisible = () => { if (document.visibilityState === 'visible') beat() }
    document.addEventListener('visibilitychange', onVisible)

    const onLeave = () => {
      if (sessionIdRef.current) {
        navigator.sendBeacon('/api/tracking', JSON.stringify({
          type: 'leave', page: lastTracked.current || '/', sessionId: sessionIdRef.current,
        }))
      }
    }
    window.addEventListener('pagehide', onLeave)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', onLeave)
    }
  }, [])

  return null
}
