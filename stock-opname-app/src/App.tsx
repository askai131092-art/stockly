import { useMemo, useState, type FormEvent } from 'react'
import {
  Activity, AlertTriangle, ArrowUpRight, Bell, Boxes, Check,
  CheckCheck, ChevronDown, CircleHelp, ClipboardCheck, ClipboardList, Download,
  FileText, LayoutDashboard, Menu, MoreHorizontal, Package, Plus, Search,
  Settings2, SlidersHorizontal, Sparkles, TrendingUp, X,
} from 'lucide-react'

type InventoryItem = {
  id: string
  sku: string
  name: string
  category: string
  location: string
  systemQuantity: number
  countedQuantity: number | null
  unit: string
  price: number
}

type ModalState = { type: 'count' | 'item'; item?: InventoryItem; edit?: boolean } | null
type Filter = 'Semua barang' | 'Belum dihitung' | 'Ada selisih' | 'Sudah sesuai'
type NavPage = 'Ringkasan' | 'Persediaan' | 'Laporan'

const initialItems: InventoryItem[] = [
  { id: '1', sku: 'ELC-001', name: 'Headphone Wireless Pro', category: 'Elektronik', location: 'Rak A-01', systemQuantity: 24, countedQuantity: 24, unit: 'pcs', price: 589000 },
  { id: '2', sku: 'ELC-002', name: 'Mouse Ergonomis M330', category: 'Elektronik', location: 'Rak A-02', systemQuantity: 38, countedQuantity: 36, unit: 'pcs', price: 179000 },
  { id: '3', sku: 'ATK-014', name: 'Notebook A5 Hardcover', category: 'Alat tulis', location: 'Rak B-03', systemQuantity: 120, countedQuantity: null, unit: 'pcs', price: 32000 },
  { id: '4', sku: 'ATK-021', name: 'Pulpen Gel Hitam 0.5', category: 'Alat tulis', location: 'Rak B-01', systemQuantity: 86, countedQuantity: 86, unit: 'pcs', price: 8500 },
  { id: '5', sku: 'FNB-008', name: 'Kopi Arabika 250gr', category: 'Makanan & minuman', location: 'Rak C-02', systemQuantity: 42, countedQuantity: 39, unit: 'pack', price: 78000 },
  { id: '6', sku: 'ELC-015', name: 'Kabel USB-C 1 Meter', category: 'Elektronik', location: 'Rak A-04', systemQuantity: 64, countedQuantity: null, unit: 'pcs', price: 45000 },
  { id: '7', sku: 'FNB-012', name: 'Teh Hijau Premium', category: 'Makanan & minuman', location: 'Rak C-01', systemQuantity: 31, countedQuantity: 31, unit: 'box', price: 56000 },
  { id: '8', sku: 'ATK-032', name: 'Sticky Notes Pastel', category: 'Alat tulis', location: 'Rak B-05', systemQuantity: 55, countedQuantity: null, unit: 'pack', price: 15000 },
]

const categories = ['Semua kategori', 'Elektronik', 'Alat tulis', 'Makanan & minuman']
const filters: Filter[] = ['Semua barang', 'Belum dihitung', 'Ada selisih', 'Sudah sesuai']
const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const currentDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

function getInitialItems(): InventoryItem[] {
  try {
    const stored = localStorage.getItem('stokly-inventory')
    if (stored) return JSON.parse(stored) as InventoryItem[]
  } catch {
    // Start with sample data if browser storage is unavailable or malformed.
  }
  return initialItems
}

function App() {
  const [items, setItems] = useState<InventoryItem[]>(getInitialItems)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Semua kategori')
  const [filter, setFilter] = useState<Filter>('Semua barang')
  const [page, setPage] = useState<NavPage>('Ringkasan')
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const saveItems = (next: InventoryItem[]) => {
    setItems(next)
    try { localStorage.setItem('stokly-inventory', JSON.stringify(next)) } catch { /* storage is optional */ }
  }

  const stats = useMemo(() => {
    const counted = items.filter((item) => item.countedQuantity !== null)
    const discrepancies = counted.filter((item) => item.countedQuantity !== item.systemQuantity)
    const shortage = discrepancies.filter((item) => (item.countedQuantity ?? 0) < item.systemQuantity).length
    const totalSystemValue = items.reduce((sum, item) => sum + item.systemQuantity * item.price, 0)
    return {
      total: items.length,
      counted: counted.length,
      discrepancies: discrepancies.length,
      shortage,
      progress: items.length ? Math.round((counted.length / items.length) * 100) : 0,
      totalSystemValue,
      varianceValue: discrepancies.reduce((sum, item) => sum + ((item.countedQuantity ?? 0) - item.systemQuantity) * item.price, 0),
    }
  }, [items])

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.name} ${item.sku} ${item.location}`.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'Semua kategori' || item.category === category
    const difference = item.countedQuantity === null ? null : item.countedQuantity - item.systemQuantity
    const matchesFilter = filter === 'Semua barang'
      || (filter === 'Belum dihitung' && item.countedQuantity === null)
      || (filter === 'Ada selisih' && difference !== null && difference !== 0)
      || (filter === 'Sudah sesuai' && difference === 0)
    return matchesSearch && matchesCategory && matchesFilter
  }), [items, search, category, filter])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const submitCount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!modal?.item) return
    const form = new FormData(event.currentTarget)
    const countedQuantity = Number(form.get('quantity'))
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) return
    saveItems(items.map((item) => item.id === modal.item?.id ? { ...item, countedQuantity } : item))
    setModal(null)
    notify('Hasil hitung berhasil disimpan')
  }

  const submitItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const item: InventoryItem = {
      id: modal?.item?.id ?? (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
      sku: String(form.get('sku')).trim().toUpperCase(),
      name: String(form.get('name')).trim(),
      category: String(form.get('category')),
      location: String(form.get('location')).trim(),
      systemQuantity: Math.max(0, Number(form.get('systemQuantity')) || 0),
      countedQuantity: modal?.edit ? modal.item?.countedQuantity ?? null : null,
      unit: String(form.get('unit')).trim() || 'pcs',
      price: Math.max(0, Number(form.get('price')) || 0),
    }
    saveItems(modal?.edit ? items.map((entry) => entry.id === item.id ? item : entry) : [item, ...items])
    setModal(null)
    notify(modal?.edit ? 'Barang berhasil diperbarui' : 'Barang baru berhasil ditambahkan')
  }

  // Import XLSX dari file pengguna (menggunakan SheetJS yang dimuat via CDN)
  const handleImportXlsx = async (file: File | null) => {
    if (!file) return
    const buffer = await file.arrayBuffer()
    // @ts-ignore global XLSX dari CDN
    const workbook = (globalThis as any).XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows: any[] = (globalThis as any).XLSX.utils.sheet_to_json(sheet, { defval: '' })
    if (!rows.length) { notify('File kosong atau format tidak dikenali'); return }

    // Deteksi kolom umum yang biasa ada pada file stok opname
    const map = {
      sku: ['sku', 'kode', 'kode barang', 'item code'],
      name: ['nama', 'nama barang', 'item', 'description'],
      category: ['kategori', 'category'],
      location: ['lokasi', 'location'],
      systemQuantity: ['stok', 'stok sistem', 'systemquantity', 'system_quantity', 'system quantity', 'qty'],
      countedQuantity: ['hitung', 'hasil hitung', 'counted', 'physical', 'count'],
      unit: ['satuan', 'unit'],
      price: ['harga', 'price']
    }

    const normalize = (s: string) => String(s).trim().toLowerCase()
    const headers = Object.keys(rows[0]).map(normalize)

    const findKey = (candidates: string[]) => {
      for (const h of headers) for (const c of candidates) if (h.includes(c)) return h
      return null
    }

    const keyMap: { [k: string]: string | null } = {
      sku: findKey(map.sku),
      name: findKey(map.name),
      category: findKey(map.category),
      location: findKey(map.location),
      systemQuantity: findKey(map.systemQuantity),
      countedQuantity: findKey(map.countedQuantity),
      unit: findKey(map.unit),
      price: findKey(map.price),
    }

    const imported: InventoryItem[] = rows.map((row, idx) => {
      const r: any = {}
      const normRow: any = {}
      Object.keys(row).forEach((k) => (normRow[normalize(k)] = row[k]))
      const id = String(normRow.sku ?? normRow.kode ?? `import-${Date.now()}-${idx}`)
      r.id = id
      r.sku = String(normRow[keyMap.sku ?? 'sku'] ?? '').trim() || id
      r.name = String(normRow[keyMap.name ?? 'nama'] ?? '').trim() || 'Nama tidak tersedia'
      r.category = String(normRow[keyMap.category ?? 'kategori'] ?? '').trim() || 'Uncategorized'
      r.location = String(normRow[keyMap.location ?? 'lokasi'] ?? '').trim() || 'Lokasi'
      r.systemQuantity = Number(normRow[keyMap.systemQuantity ?? 'stok'] ?? 0) || 0
      const countedRaw = normRow[keyMap.countedQuantity ?? 'counted'] ?? ''
      r.countedQuantity = countedRaw === '' ? null : (Number(countedRaw) || 0)
      r.unit = String(normRow[keyMap.unit ?? 'satuan'] ?? 'pcs')
      r.price = Number(normRow[keyMap.price ?? 'harga'] ?? 0) || 0
      return r as InventoryItem
    })

    saveItems([...imported, ...items])
    notify(`Impor ${imported.length} baris berhasil`) 
  }

  const exportCsv = () => {
    const rows = [
      ['SKU', 'Nama barang', 'Kategori', 'Lokasi', 'Stok sistem', 'Hasil hitung', 'Selisih', 'Satuan'],
      ...visibleItems.map((item) => [item.sku, item.name, item.category, item.location, item.systemQuantity, item.countedQuantity ?? '', item.countedQuantity === null ? '' : item.countedQuantity - item.systemQuantity, item.unit]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'laporan-stock-opname.csv'
    link.click()
    URL.revokeObjectURL(url)
    notify('Laporan CSV berhasil diunduh')
  }

  const selectPage = (nextPage: NavPage) => {
    setPage(nextPage)
    setMobileNavOpen(false)
    if (nextPage === 'Laporan') setFilter('Ada selisih')
    else setFilter('Semua barang')
  }

  const navItems: { label: NavPage; icon: typeof LayoutDashboard }[] = [
    { label: 'Ringkasan', icon: LayoutDashboard },
    { label: 'Persediaan', icon: Package },
    { label: 'Laporan', icon: FileText },
  ]

  return (
    <div className="app-shell">
      {mobileNavOpen && <button aria-label="Tutup navigasi" className="nav-scrim" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#dashboard" onClick={() => selectPage('Ringkasan')}>
          <span className="brand-mark"><Boxes size={22} strokeWidth={2.4} /></span>
          <span className="brand-name">stokly<span>.</span><small>INVENTORY MANAGEMENT</small></span>
        </a>
        <div className="workspace-switcher">
          <div className="workspace-avatar">G</div>
          <div className="workspace-copy"><span>Gudang Utama</span><small>Workspace</small></div>
          <ChevronDown size={16} />
        </div>
        <div className="nav-label">MENU UTAMA</div>
        <nav className="main-nav" aria-label="Navigasi utama">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => selectPage(label)}>
              <Icon size={18} /><span>{label}</span>{label === 'Laporan' && stats.discrepancies > 0 && <i className="nav-badge">{stats.discrepancies}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help">
          <div className="help-icon"><CircleHelp size={18} /></div>
          <strong>Butuh bantuan?</strong>
          <p>Pelajari cara mengelola stok dengan lebih mudah.</p>
          <button onClick={() => notify('Panduan penggunaan akan segera tersedia')}>Lihat panduan <ArrowUpRight size={14} /></button>
        </div>
        <button className="profile-button" onClick={() => notify('Profil pengguna')}>
          <div className="profile-avatar">AN</div><span><strong>Aditya Nugraha</strong><small>Admin Gudang</small></span><MoreHorizontal size={19} />
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Buka navigasi" onClick={() => setMobileNavOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div>
          <div className="topbar-actions">
            <div className="date-chip"><span className="live-dot" /> Periode opname <strong>Oktober 2026</strong></div>
            <button className="icon-button notification-button" aria-label="Notifikasi" onClick={() => notify('Tidak ada notifikasi baru')}><Bell size={18} /><i /></button>
            <div className="top-avatar">AN</div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> INVENTORY OVERVIEW</div>
              <h1>{page === 'Ringkasan' ? 'Ringkasan persediaan' : page === 'Persediaan' ? 'Daftar persediaan' : 'Laporan selisih'}</h1>
              <p>Pantau dan kelola proses stock opname gudangmu hari ini.</p>
            </div>
            <div className="heading-actions">
                <label className="button button-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => handleImportXlsx(e.target.files?.[0] ?? null)} />
                  <Download size={16} /> <span>Impor Excel</span>
                </label>
                <button className="button button-secondary" onClick={exportCsv}><Download size={16} /> <span>Ekspor CSV</span></button>
              <button className="button button-primary" onClick={() => setModal({ type: 'item' })}><Plus size={17} /> Tambah barang</button>
            </div>
          </section>

          <section className="summary-grid" aria-label="Ringkasan stok">
            <article className="metric-card metric-card-primary">
              <div className="metric-top"><span>Total jenis barang</span><div className="metric-icon metric-icon-blue"><Package size={17} /></div></div>
              <div className="metric-value">{stats.total}<span className="metric-unit"> SKU</span></div>
              <div className="metric-foot"><span className="metric-positive"><TrendingUp size={13} /> Aktif</span><span>di seluruh lokasi gudang</span></div>
              <div className="metric-decoration decoration-blue" />
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>Sudah dihitung</span><div className="metric-icon metric-icon-green"><ClipboardCheck size={17} /></div></div>
              <div className="metric-value">{stats.counted}<span className="metric-total"> / {stats.total}</span></div>
              <div className="metric-progress"><span style={{ width: `${stats.progress}%` }} /></div>
              <div className="metric-foot"><span className="metric-green-text">{stats.progress}% selesai</span><span>{stats.total - stats.counted} barang tersisa</span></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>Perlu perhatian</span><div className="metric-icon metric-icon-amber"><AlertTriangle size={17} /></div></div>
              <div className="metric-value">{stats.discrepancies}<span className="metric-unit"> barang</span></div>
              <div className="metric-foot"><span className="metric-amber-text">{stats.shortage} stok kurang</span><span>terdeteksi saat opname</span></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>Nilai persediaan</span><div className="metric-icon metric-icon-purple"><Activity size={17} /></div></div>
              <div className="metric-value metric-currency">{rupiah(stats.totalSystemValue)}</div>
              <div className="metric-foot"><span className={stats.varianceValue < 0 ? 'metric-red-text' : 'metric-green-text'}>{stats.varianceValue > 0 ? '+' : ''}{rupiah(stats.varianceValue)}</span><span>nilai selisih opname</span></div>
            </article>
          </section>

          <section className="work-grid">
            <article className="panel progress-panel">
              <div className="panel-heading"><div><h2>Progress stock opname</h2><p>Periode berjalan · {currentDate}</p></div><button className="more-button" aria-label="Opsi progress" onClick={() => notify('Progress diperbarui secara otomatis')}><MoreHorizontal size={20} /></button></div>
              <div className="progress-content">
                <div className="progress-ring" style={{ '--progress': `${stats.progress}%` } as React.CSSProperties}><div><strong>{stats.progress}<small>%</small></strong><span>selesai</span></div></div>
                <div className="progress-legend">
                  <div><span className="legend-dot legend-green" /><span>Sudah dihitung</span><strong>{stats.counted}</strong></div>
                  <div><span className="legend-dot legend-gray" /><span>Belum dihitung</span><strong>{stats.total - stats.counted}</strong></div>
                  <div><span className="legend-dot legend-amber" /><span>Ada selisih</span><strong>{stats.discrepancies}</strong></div>
                </div>
              </div>
              <div className="progress-callout"><div className="callout-sparkle"><Sparkles size={15} /></div><span>{stats.total - stats.counted === 0 ? 'Semua barang sudah dihitung. Kerja bagus!' : <>{stats.total - stats.counted} barang lagi untuk menyelesaikan opname.</>}</span><button onClick={() => { setFilter('Belum dihitung'); setPage('Persediaan') }}>Lanjutkan <ArrowUpRight size={14} /></button></div>
            </article>
            <article className="panel activity-panel">
              <div className="panel-heading"><div><h2>Aktivitas opname</h2><p>Ringkasan pergerakan stok</p></div><button className="period-select" onClick={() => notify('Menampilkan periode bulan ini')}>7 hari terakhir <ChevronDown size={14} /></button></div>
              <div className="chart-area">
                <div className="chart-y-labels"><span>12</span><span>8</span><span>4</span><span>0</span></div>
                <div className="chart-plot"><div className="chart-gridlines"><i /><i /><i /><i /></div><div className="bar-chart">{[{ day: 'Sen', a: 5, b: 3 }, { day: 'Sel', a: 8, b: 4 }, { day: 'Rab', a: 6, b: 3 }, { day: 'Kam', a: 10, b: 5 }, { day: 'Jum', a: 7, b: 4 }, { day: 'Sab', a: 9, b: 2 }, { day: 'Min', a: 4, b: 3 }].map((bar) => <div className="bar-group" key={bar.day}><div className="bar-pair"><i style={{ height: `${bar.a * 7}px` }} /><i style={{ height: `${bar.b * 7}px` }} /></div><span>{bar.day}</span></div>)}</div></div>
              </div>
              <div className="chart-legend"><span><i className="chart-key chart-key-blue" />Barang dihitung</span><span><i className="chart-key chart-key-mint" />Selisih ditemukan</span><span className="chart-total"><strong>{stats.counted}</strong> barang dicek</span></div>
            </article>
          </section>

          <section className="panel inventory-panel">
            <div className="inventory-heading"><div><div className="inventory-title"><h2>{page === 'Laporan' ? 'Barang dengan selisih' : 'Daftar barang'}</h2><span className="item-count">{visibleItems.length}</span></div><p>Kelola dan cocokkan stok fisik dengan catatan sistem.</p></div><button className="button button-outline" onClick={() => { setFilter('Belum dihitung'); setPage('Persediaan') }}><ClipboardList size={16} /> Mulai opname</button></div>
            <div className="table-toolbar">
              <div className="filter-tabs">{filters.map((itemFilter) => <button key={itemFilter} className={filter === itemFilter ? 'selected' : ''} onClick={() => setFilter(itemFilter)}>{itemFilter}{itemFilter === 'Belum dihitung' && <span>{items.filter((item) => item.countedQuantity === null).length}</span>}</button>)}</div>
              <div className="table-tools"><label className="search-box"><Search size={16} /><input aria-label="Cari barang" placeholder="Cari barang..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label><label className="category-select"><SlidersHorizontal size={15} /><select aria-label="Filter kategori" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></label></div>
            </div>
            <div className="table-wrap"><table><thead><tr><th>BARANG</th><th>KATEGORI</th><th>LOKASI</th><th>STOK SISTEM</th><th>HASIL HITUNG</th><th>SELISIH</th><th>STATUS</th><th aria-label="Aksi" /></tr></thead>
              <tbody>{visibleItems.map((item) => {
                const difference = item.countedQuantity === null ? null : item.countedQuantity - item.systemQuantity
                return <tr key={item.id}>
                  <td><div className="product-cell"><div className={`product-thumb thumb-${item.category === 'Elektronik' ? 'blue' : item.category === 'Alat tulis' ? 'peach' : 'green'}`}><Package size={17} /></div><span><strong>{item.name}</strong><small>{item.sku}</small></span></div></td>
                  <td><span className="category-pill">{item.category}</span></td><td><span className="location-text">{item.location}</span></td>
                  <td><strong className="quantity">{item.systemQuantity}</strong><span className="unit-text"> {item.unit}</span></td>
                  <td>{item.countedQuantity === null ? <span className="not-counted">— belum dihitung</span> : <><strong className="quantity">{item.countedQuantity}</strong><span className="unit-text"> {item.unit}</span></>}</td>
                  <td>{difference === null ? <span className="difference-empty">—</span> : difference === 0 ? <span className="difference-zero">0</span> : <span className={`difference ${difference < 0 ? 'difference-negative' : 'difference-positive'}`}>{difference > 0 ? '+' : ''}{difference}</span>}</td>
                  <td>{difference === null ? <span className="status status-pending"><i />Belum dihitung</span> : difference === 0 ? <span className="status status-done"><i />Sesuai</span> : <span className="status status-alert"><i />Ada selisih</span>}</td>
                  <td><div className="row-actions"><button className={`count-button ${item.countedQuantity !== null ? 'counted-button' : ''}`} onClick={() => setModal({ type: 'count', item })}>{item.countedQuantity === null ? 'Hitung' : <><Check size={13} /> Hitung ulang</>}</button><button className="row-menu" aria-label={`Edit ${item.name}`} onClick={() => setModal({ type: 'item', item, edit: true })}><MoreHorizontal size={18} /></button></div></td>
                </tr>
              })}</tbody>
            </table>
              {visibleItems.length === 0 && <div className="empty-state"><div><Search size={20} /></div><strong>Barang tidak ditemukan</strong><span>Coba ubah kata kunci atau filter yang dipilih.</span><button onClick={() => { setSearch(''); setCategory('Semua kategori'); setFilter('Semua barang') }}>Reset filter</button></div>}
            </div>
            <div className="table-footer"><span>Menampilkan <strong>{visibleItems.length ? 1 : 0}–{visibleItems.length}</strong> dari <strong>{items.length}</strong> barang</span><button onClick={exportCsv}><Download size={14} /> Unduh data</button></div>
          </section>
          <footer className="page-footer"><span>© 2026 Stokly. Dibuat untuk pengelolaan stok yang lebih baik.</span><span><i className="footer-online" /> Semua data tersimpan</span></footer>
        </div>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header"><div className="modal-icon">{modal.type === 'count' ? <ClipboardCheck size={19} /> : modal.edit ? <Settings2 size={19} /> : <Package size={19} />}</div><div><h2 id="modal-title">{modal.type === 'count' ? 'Hitung stok fisik' : modal.edit ? 'Edit barang' : 'Tambah barang baru'}</h2><p>{modal.type === 'count' ? 'Masukkan jumlah barang yang tersedia di gudang.' : 'Lengkapi informasi barang persediaan.'}</p></div><button className="modal-close" aria-label="Tutup" onClick={() => setModal(null)}><X size={19} /></button></div>
        {modal.type === 'count' && modal.item ? <form onSubmit={submitCount}>
          <div className="count-item-card"><div className="product-thumb thumb-blue"><Package size={18} /></div><div><strong>{modal.item.name}</strong><span>{modal.item.sku} <i /> {modal.item.location}</span></div></div>
          <label className="field-label">Stok tercatat di sistem <span>{modal.item.systemQuantity} {modal.item.unit}</span></label>
          <label className="field-label" htmlFor="physical-quantity">Jumlah stok fisik</label><div className="quantity-input-wrap"><input id="physical-quantity" autoFocus name="quantity" type="number" min="0" step="1" required defaultValue={modal.item.countedQuantity ?? ''} placeholder="Masukkan jumlah" /><span>{modal.item.unit}</span></div>
          <div className="modal-note"><CircleHelp size={15} /> Hitung barang yang tersedia secara fisik, lalu simpan hasilnya.</div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary"><CheckCheck size={16} /> Simpan hasil</button></div>
        </form> : <form onSubmit={submitItem}>
          <div className="form-grid"><label className="field-label">Nama barang<input name="name" required defaultValue={modal.item?.name} placeholder="Contoh: Mouse Wireless" /></label><label className="field-label">SKU / kode barang<input name="sku" required defaultValue={modal.item?.sku} placeholder="Contoh: ELC-001" /></label><label className="field-label">Kategori<select name="category" defaultValue={modal.item?.category ?? 'Elektronik'}>{categories.slice(1).map((entry) => <option key={entry}>{entry}</option>)}</select></label><label className="field-label">Lokasi penyimpanan<input name="location" required defaultValue={modal.item?.location} placeholder="Contoh: Rak A-01" /></label><label className="field-label">Jumlah stok sistem<input name="systemQuantity" type="number" min="0" required defaultValue={modal.item?.systemQuantity ?? 0} /></label><label className="field-label">Satuan<input name="unit" required defaultValue={modal.item?.unit ?? 'pcs'} placeholder="pcs, box, pack" /></label><label className="field-label field-full">Harga satuan (Rp)<input name="price" type="number" min="0" defaultValue={modal.item?.price ?? 0} /></label></div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Batal</button><button type="submit" className="button button-primary"><Check size={16} /> {modal.edit ? 'Simpan perubahan' : 'Tambah barang'}</button></div>
        </form>}
      </section></div>}
      {toast && <div className="toast-message"><span><Check size={15} /></span>{toast}<button aria-label="Tutup pesan" onClick={() => setToast('')}><X size={15} /></button></div>}
    </div>
  )
}

export default App