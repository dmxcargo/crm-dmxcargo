import { useEffect, useState } from 'react'
import { Chart as CJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { dashApi } from './api/resources'
import type { PerformanceRow } from './types'

CJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

interface ChartData { labels: string[]; rev: number[]; book: number[] }

export default function SalesChart() {
  const [d, setD] = useState<ChartData | null>(null)
  useEffect(() => {
    const months: string[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
    }
    Promise.allSettled(months.map((p) => dashApi.performance({ periodType: 'MONTH', period: p, groupBy: 'sales' }))).then((rs) => {
      const labels: string[] = [], rev: number[] = [], book: number[] = []
      rs.forEach((r, i) => {
        const monthKey: string = months[i] ?? ''
        const [y = '', m = '1'] = monthKey.split('-')
        labels.push(`${BLN[Number(m) - 1] ?? m} ${y.slice(2)}`)
        const v: unknown = r.status === 'fulfilled' ? r.value : []
        const list: PerformanceRow[] = Array.isArray(v) ? (v as PerformanceRow[]) : []
        rev.push(list.reduce((a, x) => a + Number(x.actualValue ?? 0), 0))
        book.push(list.reduce((a, x) => a + Number(x.closingCount ?? 0), 0))
      })
      if (rev.every((v) => v === 0) && book.every((v) => v === 0)) return
      setD({ labels, rev, book })
    })
  }, [])
  if (!d) return <p className="text-muted">Belum ada data performa 12 bulan terakhir.</p>
  return (
    <Line
      data={{
        labels: d.labels,
        datasets: [
          { label: 'Revenue (Rp)', data: d.rev, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.12)', fill: true, tension: 0.35, yAxisID: 'y' },
          { label: 'Booked', data: d.book, borderColor: '#22c55e', backgroundColor: '#22c55e', tension: 0.35, yAxisID: 'y1' },
        ],
      }}
      options={{
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { ticks: { callback: (v: string | number) => (Number(v) >= 1e9 ? `Rp${+(Number(v) / 1e9).toFixed(1)}M` : Number(v) >= 1e6 ? `Rp${+(Number(v) / 1e6).toFixed(1)}jt` : `Rp${v}`) } },
          y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 } },
        },
      }}
    />
  )
}
