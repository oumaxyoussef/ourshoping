import { formatMoney } from '../lib/money.js'
import {
  nationalPhoneDigitsForPrefix,
  phoneRestPlaceholder,
} from '../lib/countries.js'
import {
  convertSarToCurrency,
  getOrderLineDisplayAmounts,
} from '../lib/pricing.js'

/** فرق السعر مقارنةً بـ (سعر القطعة × الكمية) قبل عروض الكمية */
function getQuantityLineSavings(product, orderLine, currency) {
  if (!product || !orderLine) return null
  if (!orderLine.isPromoBundle && !orderLine.isMinUnitOverflow) return null
  const q = orderLine.quantity
  let saved
  if (currency === 'AED') {
    const pa = Number(product.priceAed)
    if (!Number.isFinite(pa) || pa <= 0) {
      const fullSar = Number(product.priceSar) * q
      saved = fullSar - orderLine.lineTotalSar
      if (saved <= 0.01) return null
      return convertSarToCurrency(saved, currency)
    }
    saved = pa * q - orderLine.lineTotalAed
  } else if (currency === 'SAR') {
    saved = Number(product.priceSar) * q - orderLine.lineTotalSar
  } else {
    const fullSar = Number(product.priceSar) * q
    saved = fullSar - orderLine.lineTotalSar
    if (saved <= 0.01) return null
    return convertSarToCurrency(saved, currency)
  }
  return saved > 0.01 ? saved : null
}

export default function CheckoutModal({
  open,
  onClose,
  selectedProduct,
  orderLine,
  orderQty,
  setOrderQty,
  currency,
  form,
  setForm,
  formError,
  onSubmit,
}) {
  if (!open) return null

  const lineDisp =
    selectedProduct && orderLine
      ? getOrderLineDisplayAmounts(orderLine, currency)
      : null

  const qtySavings =
    selectedProduct && orderLine
      ? getQuantityLineSavings(selectedProduct, orderLine, currency)
      : null

  const phoneMaxDigits = nationalPhoneDigitsForPrefix(form.phonePrefix)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
      onClick={onClose}
    >
      <div
        className="checkout-panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h2 id="checkout-title" className="text-lg font-extrabold text-gray-900">
            إتمام الطلب — الدفع عند الاستلام
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
        {selectedProduct && orderLine && lineDisp && (
          <div className="border-b border-gray-50 bg-orange-50/50 px-4 py-3">
            <p className="text-xs text-gray-500">المنتج</p>
            <p className="font-bold text-gray-900">{selectedProduct.title}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="order-qty"
                  className="mb-1 block text-xs font-bold text-gray-700"
                >
                  الكمية <span className="text-red-500">*</span>
                </label>
                <input
                  id="order-qty"
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={orderQty}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value, 10)
                    if (Number.isNaN(v) || v < 1) setOrderQty(1)
                    else setOrderQty(Math.min(99, v))
                  }}
                  className="w-full rounded-lg border-2 border-emerald-600/40 bg-white px-3 py-2 text-center text-base font-bold outline-none focus:border-temu"
                />
              </div>
              <div>
                <span className="mb-1 block text-xs font-bold text-gray-700">
                  سعر بيع القطعة <span className="text-red-500">*</span>
                </span>
                <div className="flex h-[42px] items-center rounded-lg border-2 border-emerald-600/40 bg-white px-3 text-base font-bold text-gray-900">
                  {formatMoney(lineDisp.unit, currency)}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-orange-100 pt-3">
              <span className="text-sm font-bold text-gray-700">الإجمالي</span>
              <span className="text-lg font-black text-temu">
                {formatMoney(lineDisp.line, currency)}
              </span>
            </div>
            {(orderLine.isPromoBundle || orderLine.isMinUnitOverflow) && (
              <p className="mt-2 text-center text-xs font-bold text-green-700">
                <span className="block sm:inline">
                  ✓ تم خصم
                  {qtySavings != null && (
                    <span className="ms-1 font-black text-green-800">
                      {formatMoney(qtySavings, currency)}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-emerald-800 sm:mt-0 sm:inline">
                  {orderLine.isPromoBundle
                    ? ' — عرض الكمية مطبّق على هذا العدد'
                    : ' — أقل سعر للقطعة (من العروض) يطبّق على الكمية كاملة'}
                </span>
              </p>
            )}
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4 px-4 py-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-bold text-gray-700">
              الاسم الكامل
            </label>
            <input
              id="name"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base outline-none focus:border-temu"
              placeholder="مثال: محمد العتيبي"
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-bold text-gray-700">رقم الجوال</span>
            <div className="flex gap-2">
              <select
                value={form.phonePrefix}
                onChange={(e) => {
                  const phonePrefix = e.target.value
                  const max = nationalPhoneDigitsForPrefix(phonePrefix)
                  setForm((f) => ({
                    ...f,
                    phonePrefix,
                    phoneRest: f.phoneRest.replace(/\D/g, '').slice(0, max),
                  }))
                }}
                className="rounded-xl border border-gray-200 px-2 py-2.5 text-sm font-semibold outline-none focus:border-temu sm:text-base"
              >
                <option value="+20">مصر +20</option>
                <option value="+966">السعودية +966</option>
                <option value="+971">الإمارات +971</option>
                <option value="+964">العراق +964</option>
                <option value="+968">عُمان +968</option>
              </select>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={form.phoneRest}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    phoneRest: e.target.value
                      .replace(/\D/g, '')
                      .slice(0, phoneMaxDigits),
                  }))
                }
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-base outline-none focus:border-temu"
                placeholder={phoneRestPlaceholder(form.phonePrefix)}
                maxLength={phoneMaxDigits}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              أدخل {phoneMaxDigits} رقماً بعد رمز الدولة (يتغيّر تلقائياً مع بلد التسوق أعلاه)
            </p>
          </div>
          <div>
            <label htmlFor="city" className="mb-1 block text-sm font-bold text-gray-700">
              المدينة
            </label>
            <input
              id="city"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base outline-none focus:border-temu"
              placeholder="الرياض، جدة، دبي، أبوظبي..."
            />
          </div>
          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {formError}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-full bg-temu py-3 text-base font-extrabold text-white shadow-urgent hover:bg-temu-dark"
          >
            تأكيد الطلب
          </button>
        </form>
      </div>
    </div>
  )
}
