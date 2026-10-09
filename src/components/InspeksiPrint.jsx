import { DAYS, FLOORS, KNOWER, SLOTS, VERIFIER, ymd } from '../lib/api'

// Lembar cetak formulir inspeksi (1 lantai = 1 halaman A4). Hanya tampil saat dicetak (lihat index.css).
export default function InspeksiPrint({ sheets, days, meta }) {
  const printedAt = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
  return (
    <div id="print-root">
      {sheets.map(({ floor, map }) => {
        const f = FLOORS[floor]
        const get = (d, s, it) => map[`${ymd(d)}|${s}|${it}`] || { status: null, note: '', photo: '' }

        // poin per kolom (slot × hari) dan total
        const colPoints = SLOTS.map((s) => days.map((d) => f.items.filter((it) => get(d, s, it).status === 'OK').length))
        const total = colPoints.flat().reduce((a, b) => a + b, 0)

        const photos = []
        days.forEach((d, di) => SLOTS.forEach((s) => f.items.forEach((it) => {
          const p = get(d, s, it).photo
          if (p) photos.push({ k: `${di}${s}${it}`, url: p, caption: `${DAYS[di][1]} ${s} — ${it}` })
        })))

        return (
          <section key={floor} className="print-page">
            <header className="print-head">
              <h1>CHECKLIST KEBERSIHAN</h1>
              <p className="print-floor">Lantai {floor}</p>
              <p>Minggu ke-{meta.weekNo} ({meta.monthYear}) · {meta.range}</p>
            </header>

            <table className="print-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="print-item">Kondisi Kebersihan</th>
                  {SLOTS.map((s) => <th key={s} colSpan={5}>{s}</th>)}
                </tr>
                <tr>
                  {SLOTS.map((s) => DAYS.map(([c]) => <th key={s + c} className="print-day">{c}</th>))}
                </tr>
              </thead>
              <tbody>
                {f.items.map((it) => (
                  <tr key={it}>
                    <td className="print-item">{it}</td>
                    {SLOTS.map((s) => days.map((d, i) => {
                      const st = get(d, s, it).status
                      return <td key={s + i} className={st === 'X' ? 'print-x' : ''}>{st === 'OK' ? '✓' : st === 'X' ? 'X' : ''}</td>
                    }))}
                  </tr>
                ))}
                <tr className="print-total">
                  <td className="print-item">Poin</td>
                  {colPoints.flat().map((n, i) => <td key={i}>{n}</td>)}
                </tr>
              </tbody>
            </table>
            <p className="print-sum">Total poin minggu ini: <b>{total}</b> dari {f.items.length * SLOTS.length * days.length}</p>

            {photos.length > 0 && (
              <div className="print-notes">
                <b>Foto bukti (tidak tuntas):</b>
                <ul>{photos.map((p) => <li key={p.k}>{p.caption}: {p.url}</li>)}</ul>
              </div>
            )}

            <p className="print-foot">*{meta.footnote}</p>

            <div className="print-sign">
              {[['Petugas', f.petugas], ['Verifikasi', [VERIFIER]], ['Mengetahui', [KNOWER]]].map(([title, people]) => (
                <div key={title}>
                  <p>{title}</p>
                  <div className="print-sign-space" />
                  {people.map((p) => (
                    <div key={p.name}><b>{p.name}</b><br /><span>{p.role}</span></div>
                  ))}
                </div>
              ))}
            </div>
            <p className="print-time">Dicetak {printedAt}</p>
          </section>
        )
      })}
    </div>
  )
}
