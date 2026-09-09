import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { BAY_AREA_BOUNDS } from '#/lib/geo'
import { useComboboxNav } from '#/lib/hooks/useComboboxNav'

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
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const abortRef = useRef<AbortController>(null)
  const inputId = useId()

  const nav = useComboboxNav({
    resultCount: results.length,
    onCommit: (index) => handleSelect(results[index]),
  })

  const handleSelect = useCallback(
    (result: AddressResult) => {
      onSelect(result)
      nav.setIsOpen(false)
      setResults([])
    },
    [onSelect, nav.setIsOpen],
  )

  const search = useCallback(
    async (query: string) => {
      abortRef.current?.abort()
      if (query.length < MIN_QUERY_LENGTH) {
        setResults([])
        nav.setIsOpen(false)
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

        const data = (await res.json()) as {
          display_name: string
          lat: string
          lon: string
        }[]
        const mapped = data.map((r) => ({
          displayName: r.display_name,
          lat: Number.parseFloat(r.lat),
          lng: Number.parseFloat(r.lon),
        }))

        setResults(mapped)
        nav.setActiveIndex(-1)
        nav.setIsOpen(mapped.length > 0)
      } catch {
        // Aborted or network error — ignore
      } finally {
        setLoading(false)
      }
    },
    [nav.setActiveIndex, nav.setIsOpen],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      onChange(val)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => search(val), DEBOUNCE_MS)
    },
    [onChange, search],
  )

  // Clean up timer and abort controller on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div ref={nav.containerRef} className="relative">
      <label
        htmlFor={inputId}
        className="mb-1 block text-xs font-semibold text-[var(--text-muted)]"
      >
        Address
      </label>
      <div className="relative">
        <input
          id={inputId}
          data-testid="field-address"
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={nav.handleKeyDown}
          onFocus={() => {
            if (results.length > 0) nav.setIsOpen(true)
          }}
          placeholder="Search for an address..."
          autoComplete="off"
          role="combobox"
          aria-expanded={nav.isOpen}
          aria-controls={nav.listboxId}
          aria-activedescendant={
            nav.activeIndex >= 0
              ? `address-result-${nav.activeIndex}`
              : undefined
          }
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
            ...
          </span>
        )}
      </div>

      {nav.isOpen && results.length > 0 && (
        <div
          id={nav.listboxId}
          data-testid="address-results"
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg"
        >
          {results.map((r, i) => (
            <div
              key={`${r.lat}-${r.lng}`}
              id={`address-result-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === nav.activeIndex}
              onMouseDown={() => handleSelect(r)}
              className={`cursor-pointer px-3 py-2 text-xs text-[var(--text)] ${
                i === nav.activeIndex
                  ? 'bg-[var(--blue)]/10'
                  : 'hover:bg-[color-mix(in_oklab,var(--surface),var(--text)_6%)]'
              }`}
            >
              {r.displayName}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
