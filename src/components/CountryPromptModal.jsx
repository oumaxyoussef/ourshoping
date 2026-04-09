import { COUNTRIES, setStoredCountry } from '../lib/countries.js'

export default function CountryPromptModal({ open, onSelected }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="country-prompt-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2
          id="country-prompt-title"
          className="text-center text-lg font-extrabold text-gray-900 sm:text-xl"
        >
          اختر بلدك
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          لعرض المنتجات المتوفرة للشحن إلى منطقتك
        </p>
        <ul className="mt-4 max-h-[min(60vh,22rem)] space-y-1 overflow-y-auto">
          {COUNTRIES.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setStoredCountry(c.id)
                  onSelected(c.id)
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-start text-sm font-bold text-gray-900 transition hover:border-teal-200 hover:bg-teal-50"
              >
                <span className="text-2xl" aria-hidden>
                  {c.flag}
                </span>
                <span className="flex-1">{c.nameAr}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
