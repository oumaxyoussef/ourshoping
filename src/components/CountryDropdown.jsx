import { useEffect, useRef, useState } from 'react'
import {
  COUNTRIES,
  COUNTRY_BY_ID,
  setStoredCountry,
} from '../lib/countries.js'

export default function CountryDropdown({ countryId, onCountryChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const current = countryId ? COUNTRY_BY_ID[countryId] : null

  useEffect(() => {
    const fn = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full max-w-[min(100%,18rem)] items-center gap-2 rounded-lg border border-gray-200 bg-white py-2 pe-3 ps-2 text-start text-sm font-bold text-gray-900 shadow-sm transition hover:border-teal-300 sm:max-w-xs sm:gap-2.5 sm:py-2.5 sm:pe-4 sm:text-base"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-lg sm:h-9 sm:w-9 sm:text-xl">
          {current?.flag ?? '🌍'}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs sm:text-sm">
          {current?.nameAr ?? 'البلد'}
        </span>
        <span className="shrink-0 text-gray-400" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] cursor-default bg-black/20"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
          />
          <ul
            className="absolute end-0 top-full z-[60] mt-1 max-h-[min(70vh,20rem)] w-[min(100vw-1.5rem,20rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white py-2 shadow-xl"
            role="listbox"
          >
            {COUNTRIES.map((c) => (
              <li key={c.id} role="option" aria-selected={c.id === countryId}>
                <button
                  type="button"
                  onClick={() => {
                    setStoredCountry(c.id)
                    onCountryChange(c.id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm font-bold transition hover:bg-gray-50 ${
                    c.id === countryId ? 'bg-sky-50 text-sky-900' : 'text-gray-900'
                  }`}
                >
                  <span className="text-xl" aria-hidden>
                    {c.flag}
                  </span>
                  <span className="min-w-0 flex-1">{c.nameAr}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
