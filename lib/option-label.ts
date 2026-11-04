/* eslint-disable @typescript-eslint/no-explicit-any */
// Câu trắc nghiệm không giới hạn số đáp án.
// Nhãn đáp án theo kiểu cột Excel: A, B, ..., Z, AA, AB, ...

// 0 -> "A", 25 -> "Z", 26 -> "AA", 27 -> "AB" ...
export function optionLabel(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// "A" -> 0, "G" -> 6, "AA" -> 26. Trả về undefined nếu không phải chữ cái hợp lệ.
export function labelToIndex(label: string): number | undefined {
  const t = String(label ?? '').trim().toUpperCase()
  if (!/^[A-Z]+$/.test(t)) return undefined
  let n = 0
  for (const ch of t) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

// Lấy danh sách đáp án từ 1 dòng của sheet mcq: mọi cột option_<nhãn>
// (option_a, option_b, ... option_g, option_h, ...), xếp theo thứ tự nhãn.
// Ô trống bị bỏ qua (giữ nguyên cách xử lý cũ).
export function extractOptions(row: Record<string, any>): string[] {
  const cols: { key: string; idx: number }[] = []
  for (const key of Object.keys(row)) {
    const m = key.trim().match(/^option_([a-z]+)$/i)
    if (!m) continue
    const idx = labelToIndex(m[1])
    if (idx !== undefined) cols.push({ key, idx })
  }
  cols.sort((a, b) => a.idx - b.idx)
  return cols.map(c => String(row[c.key] ?? '').trim()).filter(o => o !== '')
}
