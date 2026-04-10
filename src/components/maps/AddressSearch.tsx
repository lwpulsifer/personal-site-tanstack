import { useState, useRef, useEffect, useCallback } from 'react'
import { BAY_AREA_BOUNDS } from '#/lib/geo'

export interface AddressResult {
  displayName: string
  lat: number
  lng: number
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const DEBOUNCE_MS = 400
const MIN_QUERY_LENGTH = 3

export function AddressSearch({
  value,
  onChange,
  onSelect,
}: {
  value: string
  onChange: (value: string) => void
  onSelect: (result: AddressResult) => void
}) {
  const [results, setResults] = useState<AddressResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const abortRef = useRef<AbortController>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (query: string) => {
    abortRef.current?.abort()
    if (query.length < MIN_QUERY_LENGTH) {
      setResults([])
      setIsOpen(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        limit: '5',
        viewbox: `${BAY_AREA_BOUNDS.minLng},${BAY_AREA_BOUNDS.maxLat},${BAY_AREA_BOUNDS.maxLng},${BAY_AREA_BOUNDS.minLat}`,
        bounded: '0',
      })

      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'LionsOfSF/1.0' },
      })

      if (!res.ok) return

      const data = (await res.json()) as { display_name: string; lat: string; lon: string }[]
      const mapped = data.map((r) => ({
        displayName: r.display_name,
        lat: Number.parseFloat(r.lat),
        lng: Number.parseFloat(r.lon),
      }))

      setResults(mapped)
      setActiveIndex(-1)
      setIsOpen(mapped.length > 0)
    } catch {
      // Aborted or network error — ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      onChange(val)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => search(val), DEBOUNCE_MS)
    },
    [onChange, search],
  )

  const handleSelect = useCallback(
    (result: AddressResult) => {
      onSelect(result)
      setIsOpen(false)
      setResults([])
    },
    [onSelect],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1))
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault()
        handleSelect(results[activeIndex])
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    },
    [isOpen, results, activeIndex, handleSelect],
  )

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Clean up timer and abort controller on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="lion-address" className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
        Address
      </label>
      <div className="relative">
        <input
          id="lion-address"
          data-testid="field-address"
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
          placeholder="Search for an address..."
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="address-results"
          aria-activedescendant={activeIndex >= 0 ? `address-result-${activeIndex}` : undefined}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">...</span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          id="address-results"
          data-testid="address-results"
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg"
        >
          {results.map((r, i) => (
            <li
              key={`${r.lat}-${r.lng}`}
              id={`address-result-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(r)}
              className={`cursor-pointer px-3 py-2 text-xs text-[var(--text)] ${
                i === activeIndex ? 'bg-[var(--blue)]/10' : 'hover:bg-[color-mix(in_oklab,var(--surface),var(--text)_6%)]'
              }`}
            >
              {r.displayName}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
