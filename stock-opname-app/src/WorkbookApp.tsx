import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Activity, AlertTriangle, ArrowDownToLine, Barcode, Boxes, Check, CheckCircle2, ClipboardList, FileSpreadsheet, LayoutDashboard, Menu, PackageCheck, Plus, Search, ScanLine, Settings2, ShieldAlert, Trash2, Upload, X } from 'lucide-react'

type Master = { layout: string; code: string; serial: string; brand: string; warehouse: string; name: string; box?: string; pj?: string }
type Scan = { id: string; serial: string; layout: string; rack?: string; time: string; item?: Master; status: 'Found' | 'Not In VEF' | 'DUPLICATE' }
type ManualActivity = { id: string; timestamp: number; time: string; code: string; warehouse: string; field: 'box' | 'pj'; value: string }
type HistoryEvent = { id: string; timestamp: number; time: string; title: string; detail: string; status?: Scan['status']; kind: 'scan' | 'box' | 'pj' }
type Screen = 'Ringkasan' | 'VEF Master' | 'Scan SN' | 'Scan Result' | 'Reconciliation' | 'Recap'

declare global { interface Window { XLSX?: any } }
const screens: { name: Screen; label?: string; icon: typeof LayoutDashboard }[] = [
  { name: 'Ringkasan', label: 'Dashboard', icon: LayoutDashboard }, { name: 'VEF Master', icon: Boxes },
  { name: 'Scan SN', icon: ScanLine }, { name: 'Scan Result', icon: ClipboardList },
  { name: 'Reconciliation', icon: Activity }, { name: 'Recap', icon: FileSpreadsheet },
]
const seedMaster: Master[] = [
  { layout: '1', code: 'ASUS-X1504', serial: 'SN-AX15-002841', brand: 'ASUS', warehouse: 'WH Jakarta', name: 'VivoBook 15 X1504ZA' },
  { layout: '1', code: 'ASUS-X1504', serial: 'SN-AX15-002842', brand: 'ASUS', warehouse: 'WH Jakarta', name: 'VivoBook 15 X1504ZA' },
  { layout: '1', code: 'LEN-I5-14', serial: 'SN-LN14-003210', brand: 'Lenovo', warehouse: 'WH Jakarta', name: 'ThinkPad E14 Gen 5' },
  { layout: '2', code: 'HP-840G10', serial: 'SN-HP84-001034', brand: 'HP', warehouse: 'WH Bandung', name: 'EliteBook 840 G10' },
  { layout: '2', code: 'DELL-LAT5440', serial: 'SN-DL54-008524', brand: 'Dell', warehouse: 'WH Bandung', name: 'Latitude 5440' },
  { layout: '3', code: 'ASUS-TUF-A15', serial: 'SN-TUF15-002130', brand: 'ASUS', warehouse: 'WH Surabaya', name: 'TUF Gaming A15' },
  { layout: '3', code: 'MAC-MBP14', serial: 'SN-MBP14-000782', brand: 'Apple', warehouse: 'WH Jakarta', name: 'MacBook Pro 14” M3' },
  { layout: '4', code: 'LEN-LOQ15', serial: 'SN-LOQ15-003121', brand: 'Lenovo', warehouse: 'WH Bandung', name: 'LOQ 15IRX9' },
]
const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const qty = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0
const formatDifference = (difference: number) => difference < 0 ? `+${fmt(Math.abs(difference))}` : difference > 0 ? `−${fmt(difference)}` : '0'
const localTime = () => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
const tidy = (v: unknown) => String(v ?? '').trim()
const key = (v: unknown) => tidy(v).toLowerCase().replace(/[\s_\-./]+/g, '')
const readStore = <T,>(name: string, fallback: T): T => { try { const data = localStorage.getItem(`stokly-workbook-${name}`); return data ? JSON.parse(data) as T : fallback } catch { return fallback } }

export default function WorkbookApp() {
  const [master, setMaster] = useState<Master[]>(() => readStore('master', seedMaster))
  const [sourceFile, setSourceFile] = useState(() => readStore<string>('source-file', ''))
  const [scans, setScans] = useState<Scan[]>(() => readStore('scans', []))
  const [manualActivities, setManualActivities] = useState<ManualActivity[]>(() => readStore('manual-activities', []))
  const [screen, setScreen] = useState<Screen>('Ringkasan')
  const [layout, setLayout] = useState('1')
  const [rackNumbers, setRackNumbers] = useState<Record<string, string>>(() => readStore('rack-numbers', {}))
  const [scanTargets, setScanTargets] = useState<Record<string, string>>(() => readStore('scan-targets', {}))
  const [scanStartedLayout, setScanStartedLayout] = useState<string | null>(null)
  const [scanInputs, setScanInputs] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmMasterDelete, setConfirmMasterDelete] = useState(false)
  const scanRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const manualEditStart = useRef<string | null>(null)

  const loadAttachedWorkbook = async () => {
    try {
      const workbookUrl = new URL('SO%20by%20SN%20Master%20Toko.xlsx', document.baseURI)
      const response = await fetch(workbookUrl)
      if (!response.ok) return
      const file = new File([await response.arrayBuffer()], 'SO by SN Master Toko.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const transfer = new DataTransfer()
      transfer.items.add(file)
      if (fileRef.current) {
        fileRef.current.files = transfer.files
        await importWorkbook({ target: fileRef.current } as ChangeEvent<HTMLInputElement>)
      }
    } catch { /* Workbook can be selected manually if it is not hosted with the app. */ }
  }

  const persistMaster = (data: Master[]) => { setMaster(data); try { localStorage.setItem('stokly-workbook-master', JSON.stringify(data)) } catch { notify('Data terlalu besar untuk penyimpanan browser') } }
  const persistScans = (data: Scan[]) => { setScans(data); try { localStorage.setItem('stokly-workbook-scans', JSON.stringify(data)) } catch { notify('Penyimpanan browser penuh') } }
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000) }
  const deleteMaster = () => {
    if (!master.length) return
    persistMaster([])
    setSourceFile('')
    setConfirmMasterDelete(false)
    try { localStorage.setItem('stokly-workbook-source-file', JSON.stringify('')) } catch { /* optional metadata */ }
    notify('Semua data VEF Master berhasil dihapus')
  }

  const counts = useMemo(() => {
    const bySerial = new Map<string, number>()
    scans.forEach((scan) => { if (scan.status === 'Found') bySerial.set(scan.serial.toUpperCase(), (bySerial.get(scan.serial.toUpperCase()) ?? 0) + 1) })
    const found = scans.filter((scan) => scan.status === 'Found').length
    const duplicate = scans.filter((scan) => scan.status === 'DUPLICATE').length
    const unknown = scans.filter((scan) => scan.status === 'Not In VEF').length
    const matchedSerials = new Set(scans.filter((scan) => scan.status === 'Found').map((scan) => scan.serial.toUpperCase()))
    const manualByGroup = new Map<string, { box: string; pj: string }>()
    master.forEach((item) => {
      const group = `${item.code}|${item.warehouse}`
      if (!manualByGroup.has(group)) manualByGroup.set(group, { box: item.box ?? '', pj: item.pj ?? '' })
    })
    const manualQty = [...manualByGroup.values()].reduce((total, values) => total + qty(values.box) + qty(values.pj), 0)
    const accounted = matchedSerials.size + manualQty
    return { sku: new Set(master.map((item) => item.code).filter(Boolean)).size, qty: master.length, found, duplicate, unknown, matched: matchedSerials.size, manualQty, missing: Math.max(0, master.length - accounted), progress: master.length ? Math.min(100, Math.round(accounted / master.length * 100)) : 0 }
  }, [master, scans])

  const visibleMaster = useMemo(() => master.filter((item) => `${item.code} ${item.serial} ${item.name} ${item.brand} ${item.warehouse} ${item.layout}`.toLowerCase().includes(query.toLowerCase())), [master, query])
  const visibleScans = useMemo(() => scans.filter((item) => `${item.serial} ${item.item?.code ?? ''} ${item.item?.name ?? ''} ${item.status} ${item.rack ?? item.layout}`.toLowerCase().includes(query.toLowerCase())), [scans, query])
  const recap = useMemo(() => {
    const groups = new Map<string, { code: string; name: string; brand: string; warehouse: string; box: string; pj: string; total: number; scanned: number; missing: number }>()
    master.forEach((item) => {
      const key = `${item.code}|${item.warehouse}`
      if (!groups.has(key)) groups.set(key, { code: item.code, name: item.name, brand: item.brand, warehouse: item.warehouse, box: item.box ?? '', pj: item.pj ?? '', total: 0, scanned: 0, missing: 0 })
      groups.get(key)!.total++
    })
    const found = new Set(scans.filter((scan) => scan.status === 'Found').map((scan) => scan.serial.toUpperCase()))
    master.forEach((item) => {
      const key = `${item.code}|${item.warehouse}`
      if (found.has(item.serial.toUpperCase())) groups.get(key)!.scanned++
    })
    groups.forEach((group) => { group.missing = group.total - (group.scanned + qty(group.box) + qty(group.pj)) })
    return [...groups.values()].filter((group) => `${group.code} ${group.name} ${group.brand} ${group.warehouse} ${group.box} ${group.pj}`.toLowerCase().includes(query.toLowerCase()))
  }, [master, scans, query])

  const recapRows = screen === 'Recap' ? recap.filter((row) => row.missing !== 0) : recap

  const updateRecapField = (entry: (typeof recap)[number], field: 'box' | 'pj', value: string) => {
    persistMaster(master.map((item) => item.code === entry.code && item.warehouse === entry.warehouse ? { ...item, [field]: value } : item))
  }

  const recordManualActivity = (entry: (typeof recap)[number], field: 'box' | 'pj', value: string) => {
    const timestamp = Date.now()
    const activity: ManualActivity = { id: `${timestamp}-${Math.random().toString(36).slice(2, 7)}`, timestamp, time: localTime(), code: entry.code, warehouse: entry.warehouse, field, value }
    const next = [activity, ...manualActivities]
    setManualActivities(next)
    try { localStorage.setItem('stokly-workbook-manual-activities', JSON.stringify(next)) } catch { /* Activity history is optional when browser storage is full. */ }
  }

  const recentActivities = useMemo<HistoryEvent[]>(() => [
    ...scans.map((scan) => ({ id: scan.id, timestamp: Number(scan.id.split('-')[0]) || 0, time: scan.time, title: 'Scan serial number', detail: `${scan.serial} · Rack ${scan.rack ?? rackNumbers[scan.layout] ?? scan.layout}`, status: scan.status, kind: 'scan' as const })),
    ...manualActivities.map((activity) => ({ id: activity.id, timestamp: activity.timestamp, time: activity.time, title: activity.field === 'box' ? 'Isi jumlah Box' : 'Isi jumlah PJ', detail: `${activity.code}${activity.warehouse ? ` · ${activity.warehouse}` : ''} · ${activity.value || '0'} unit`, kind: activity.field as 'box' | 'pj' })),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10), [scans, manualActivities])

  const importWorkbook = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!window.XLSX) { notify('Pembaca Excel gagal dimuat. Periksa koneksi internet.'); return }
    setBusy(true)
    try {
      const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
      const sheetName = wb.SheetNames.find((name: string) => key(name) === 'vefmaster') ?? wb.SheetNames[0]
      const rows: unknown[][] = window.XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false })
      const headerIndex = rows.findIndex((row) => row.some((cell) => ['itemcode', 'serialno', 'layoutnumber'].includes(key(cell))))
      if (headerIndex < 0) throw new Error(`Kolom master tidak ditemukan di sheet “${sheetName}”`)
      const header = rows[headerIndex].map(key)
      const col = (names: string[]) => header.findIndex((h) => names.includes(h))
      const indexes = { layout: col(['layoutnumber', 'layout']), code: col(['itemcode', 'mcode', 'code']), serial: col(['serialno', 'serialnumber', 'sn']), brand: col(['brand']), warehouse: col(['warehouse']), name: col(['itemname', 'name']), box: col(['box', 'boxnumber', 'nobox']), pj: col(['pj', 'penanggungjawab', 'personincharge']) }
      if (indexes.serial < 0 && indexes.code < 0) throw new Error('Kolom Item Code atau Serial No tidak ditemukan')
      const records = rows.slice(headerIndex + 1).flatMap((row) => {
        const item = { layout: tidy(row[indexes.layout]), code: tidy(row[indexes.code]), serial: tidy(row[indexes.serial]), brand: tidy(row[indexes.brand]), warehouse: tidy(row[indexes.warehouse]), name: tidy(row[indexes.name]), box: tidy(row[indexes.box]), pj: tidy(row[indexes.pj]) }
        return item.code || item.serial ? [item] : []
      })
      if (!records.length) throw new Error(`Sheet “${sheetName}” belum memiliki baris master barang`)
      persistMaster(records)
      setSourceFile(file.name)
      try { localStorage.setItem('stokly-workbook-source-file', JSON.stringify(file.name)) } catch { /* optional metadata */ }
      setScreen('Ringkasan')
      notify(`${fmt(records.length)} unit dari sheet “${sheetName}” berhasil dimuat`)
    } catch (error) { notify(error instanceof Error ? error.message : 'File Excel gagal dibaca') }
    finally { setBusy(false); event.target.value = '' }
  }

  const recordScan = (rawSerial: string, targetLayout: string) => {
    const serial = rawSerial.trim()
    if (!serial) return
    const rackNumber = rackNumbers[targetLayout]?.trim()
    if (!rackNumber) {
      notify('Isi nomor Rack pada kartu ini sebelum melakukan scan')
      return
    }
    const targetQty = Number.parseInt(scanTargets[targetLayout] ?? '', 10)
    if (scanStartedLayout !== targetLayout || !Number.isInteger(targetQty) || targetQty <= 0) {
      notify('Isi jumlah target lalu mulai scan pada Rack ini')
      return
    }
    const validCount = scans.filter((scan) => scan.layout === targetLayout && scan.status === 'Found').length
    if (validCount >= targetQty) {
      setScanStartedLayout(null)
      notify(`Target ${targetQty} item Rack ${rackNumber} sudah tercapai`)
      return
    }
    const upper = serial.toUpperCase()
    const duplicate = scans.some((scan) => scan.serial.toUpperCase() === upper && scan.status === 'Found')
    const item = master.find((row) => row.serial.toUpperCase() === upper)
    const status: Scan['status'] = duplicate ? 'DUPLICATE' : item ? 'Found' : 'Not In VEF'
    const entry: Scan = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, serial, layout: targetLayout, rack: rackNumber, time: localTime(), item, status }
    persistScans([entry, ...scans])
    setScanInputs((current) => ({ ...current, [targetLayout]: '' }))
    setLayout(targetLayout)
    const targetReached = status === 'Found' && validCount + 1 >= targetQty
    if (targetReached) setScanStartedLayout(null)
    notify(status === 'Found' ? targetReached ? `${serial} cocok · target ${targetQty} item Rack ${rackNumber} tercapai` : `${serial} cocok · Rack ${rackNumber}` : status === 'DUPLICATE' ? `${serial} duplikat · Rack ${rackNumber}` : `${serial} tidak ada di master · Rack ${rackNumber}`)
  }

  const startScan = (targetLayout = layout) => {
    const rackNumber = rackNumbers[targetLayout]?.trim()
    if (!rackNumber) {
      notify('Isi nomor Rack pada kartu ini sebelum mulai scan')
      return
    }
    const targetQty = Number.parseInt(scanTargets[targetLayout] ?? '', 10)
    if (!Number.isInteger(targetQty) || targetQty <= 0) {
      notify('Masukkan jumlah item target minimal 1 sebelum mulai scan')
      return
    }
    const validCount = scans.filter((scan) => scan.layout === targetLayout && scan.status === 'Found').length
    if (validCount >= targetQty) {
      notify(`Jumlah scan valid Rack ${rackNumbers[targetLayout] || targetLayout} sudah mencapai target ${targetQty}`)
      return
    }
    setLayout(targetLayout)
    setScanStartedLayout(targetLayout)
    setTimeout(() => document.getElementById(`layout-scan-${targetLayout}`)?.focus(), 20)
  }

  const finishScan = (targetLayout = layout) => {
    const targetQty = Number.parseInt(scanTargets[targetLayout] ?? '', 10)
    const validCount = scans.filter((scan) => scan.layout === targetLayout && scan.status === 'Found').length
    if (validCount < targetQty) {
      notify(`Jumlah scan Rack ${rackNumbers[targetLayout] || targetLayout} belum sesuai target. Kurang ${targetQty - validCount} item.`)
      return
    }
    setScanStartedLayout(null)
    notify(`Sesi scan Rack ${rackNumbers[targetLayout] || targetLayout} selesai`)
  }

  const deleteScan = (id: string) => { persistScans(scans.filter((scan) => scan.id !== id)); notify('Baris scan dihapus') }
  const exportCsv = (rows: unknown[][], filename: string) => {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
  }
  const exportCurrent = () => {
    if (screen === 'VEF Master') exportCsv([['Layout Number', 'Item Code', 'Serial No', 'Brand', 'Warehouse', 'Item Name'], ...visibleMaster.map((r) => [r.layout, r.code, r.serial, r.brand, r.warehouse, r.name])], 'vef-master.csv')
    else if (screen === 'Reconciliation' || screen === 'Recap') exportCsv([['No', 'Item Code', 'Item Name', 'Brand', 'Warehouse', 'Total VEF', 'Total Scan', 'Box', 'PJ', 'Selisih'], ...recapRows.map((r, index) => [index + 1, r.code, r.name, r.brand, r.warehouse, r.total, r.scanned, r.box, r.pj, formatDifference(r.missing)])], 'rekap-selisih.csv')
    else exportCsv([['Serial No', 'Item Code', 'Item Name', 'Brand', 'Warehouse', 'Rack Number', 'Status', 'Waktu'], ...visibleScans.map((r) => [r.serial, r.item?.code, r.item?.name, r.item?.brand, r.item?.warehouse, r.rack ?? rackNumbers[r.layout] ?? r.layout, r.status, r.time])], 'scan-result.csv')
    notify('Laporan berhasil diunduh dalam format CSV')
  }

  const changeScreen = (name: Screen) => { setScreen(name); setQuery(''); setMobileOpen(false) }
  const pageTitle: Record<Screen, string> = { Ringkasan: 'Dashboard', 'VEF Master': 'VEF Master', 'Scan SN': 'Scan serial number', 'Scan Result': 'Scan Result', Reconciliation: 'Reconciliation', Recap: 'Rekap selisih' }

  return <div className="wb-shell">
    {mobileOpen && <button className="wb-scrim" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`wb-sidebar ${mobileOpen ? 'wb-sidebar-open' : ''}`}>
      <a className="wb-brand" href="#home" onClick={() => changeScreen('Ringkasan')}><span><Boxes size={21} /></span><b>stokly<i>.</i><small>STOCK OPNAME</small></b></a>
      <nav className="wb-nav">{screens.map(({ name, label, icon: Icon }) => <button key={name} className={screen === name ? 'active' : ''} onClick={() => changeScreen(name)}><Icon size={17} /><span>{label ?? name}</span>{name === 'Scan Result' && counts.duplicate + counts.unknown > 0 && <em>{counts.duplicate + counts.unknown}</em>}</button>)}</nav>
      <div className="wb-sidebar-bottom"><div className="wb-sidebar-help"><ShieldAlert size={16} /><span><b>Validasi serial otomatis</b><small>Serial ganda dan yang tidak ada di master akan ditandai.</small></span></div><button className="wb-profile"><span>SN</span><b>Operator Gudang<small>Administrator</small></b><Settings2 size={17} /></button></div>
    </aside>
    <main className="wb-main">
      <header className="wb-topbar"><button className="wb-menu-button" onClick={() => setMobileOpen(true)} aria-label="Buka menu"><Menu size={20} /></button><div className="wb-crumb">Stock opname <i>/</i> <b>{screen === 'Ringkasan' ? 'Dashboard' : screen}</b></div><div className="wb-top-actions"><span className="wb-live"><i /> Sesi opname aktif</span><span className="wb-top-avatar">SN</span></div></header>
      <div className="wb-page">
        <div className="wb-heading"><div><div className="wb-eyebrow"><i /> SERIAL NUMBER INVENTORY</div><h1>{pageTitle[screen]}</h1><p>{screen === 'Scan SN' ? 'Isi nomor Rack dan target pada kartu Rack sebelum mulai memindai.' : 'Kelola master barang, pemindaian SN, dan rekonsiliasi dalam satu alur.'}</p></div><div className="wb-heading-buttons">{screen === 'VEF Master' && <><input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={importWorkbook} /><button className="wb-button wb-button-light" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={15} />{busy ? 'Memuat…' : 'Muat XLSX'}</button></>}{screen === 'Scan SN' && <button className="wb-button wb-button-primary" onClick={() => scanStartedLayout === layout ? finishScan(layout) : startScan(layout)}><ScanLine size={16} />{scanStartedLayout === layout ? 'Selesaikan scan' : 'Mulai scan'}</button>}</div></div>
        {screen === 'VEF Master' && <div className="wb-file-notice"><div className="wb-notice-icon"><FileSpreadsheet size={17} /></div><span><b>{sourceFile || (master === seedMaster ? 'Contoh data aktif' : 'Master VEF termuat')}</b><small>{master === seedMaster ? 'Pilih workbook untuk mengisi VEF Master sebelum memulai scan.' : `${fmt(master.length)} unit · ${fmt(counts.sku)} item code · siap dipindai`}</small></span><div className="wb-file-actions">{master === seedMaster && <button onClick={loadAttachedWorkbook}>Gunakan file terunggah <FileSpreadsheet size={13} /></button>}<button onClick={() => fileRef.current?.click()}>{master === seedMaster ? 'Pilih XLSX' : 'Ganti file'} <Upload size={13} /></button></div></div>}
        {screen === 'Ringkasan' && <>
          <section className="wb-metrics"><article><div><span>Total SKU VEF</span><i className="mi-blue"><Boxes size={17} /></i></div><b>{fmt(counts.sku)}</b><small>Item code unik pada master</small></article><article><div><span>Total Qty VEF</span><i className="mi-green"><PackageCheck size={17} /></i></div><b>{fmt(counts.qty)}</b><small>Serial number terdaftar</small></article><article><div><span>Total Qty Terhitung</span><i className="mi-violet"><ScanLine size={17} /></i></div><b>{fmt(counts.matched + counts.manualQty)}</b><small>{fmt(counts.matched)} scan valid + {fmt(counts.manualQty)} Box/PJ manual</small></article><article><div><span>Perlu rekonsiliasi</span><i className="mi-amber"><AlertTriangle size={17} /></i></div><b>{fmt(counts.missing + counts.duplicate + counts.unknown)}</b><small>{fmt(counts.missing)} belum terhitung · {fmt(counts.duplicate + counts.unknown)} temuan</small></article></section>
          <section className="wb-overview-grid"><article className="wb-card wb-progress-card"><div className="wb-card-head"><div><h2>Progress stock opname</h2><p>Persentase unit yang sudah dihitung melalui scan, Box, atau PJ.</p></div><span className="wb-round-icon"><Activity size={17} /></span></div><div className="wb-progress-body"><div className="wb-progress-ring" style={{ '--wb-progress': `${counts.progress}%` } as React.CSSProperties}><div><b>{counts.progress}<small>%</small></b><span>terhitung</span></div></div><div className="wb-progress-list"><p><i className="dot-found" />Scan + Box/PJ<span>{fmt(counts.matched + counts.manualQty)}</span></p><p><i className="dot-missing" />Belum terhitung<span>{fmt(counts.missing)}</span></p><p><i className="dot-issue" />Anomali scan<span>{fmt(counts.duplicate + counts.unknown)}</span></p></div></div><button className="wb-next-step" onClick={() => { changeScreen('Scan SN'); setTimeout(() => scanRef.current?.focus(), 50) }}><span><ScanLine size={16} /></span><b>Lanjutkan sesi scan<small>Pindai serial number berikutnya</small></b><Plus size={17} /></button></article>
          <article className="wb-card wb-activity-card"><div className="wb-card-head"><div><h2>Status hasil pemindaian</h2><p>Ringkasan seluruh serial yang telah dipindai.</p></div><button className="wb-link" onClick={() => changeScreen('Scan Result')}>Lihat semua →</button></div><div className="wb-result-total"><strong>{fmt(scans.length)}</strong><span>total aktivitas scan</span><div><ScanLine size={16} /></div></div><div className="wb-status-bars"><p><span><i className="dot-found" />Found</span><b>{counts.found}</b></p><div><i className="bar-found" style={{ width: `${scans.length ? counts.found / scans.length * 100 : 0}%` }} /></div><p><span><i className="dot-issue" />Not In VEF</span><b>{counts.unknown}</b></p><div><i className="bar-issue" style={{ width: `${scans.length ? counts.unknown / scans.length * 100 : 0}%` }} /></div><p><span><i className="dot-duplicate" />Duplicate</span><b>{counts.duplicate}</b></p><div><i className="bar-duplicate" style={{ width: `${scans.length ? counts.duplicate / scans.length * 100 : 0}%` }} /></div></div></article></section>
          <MissingItemsTable rows={recap.filter((row) => row.missing > 0).slice(0, 10)} />
          <ActivityHistory events={recentActivities} onView={() => changeScreen('Scan Result')} />
        </>}
        {screen === 'VEF Master' && <><section className="wb-summary-strip"><b>VEF MASTER</b><span><strong>{fmt(counts.sku)}</strong> SKU unik</span><span><strong>{fmt(counts.qty)}</strong> Serial terdaftar</span><span>Sheet sumber: <strong>VEF Master</strong></span></section><div className="wb-table-tools"><label><Search size={15} /><input placeholder="Cari item code, serial, brand…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><button className="wb-button wb-button-light" onClick={exportCurrent}><ArrowDownToLine size={15} /> Ekspor</button><button className="wb-button wb-button-light wb-delete-master" onClick={() => setConfirmMasterDelete(true)} disabled={!master.length}><Trash2 size={15} /> Hapus master</button></div>{confirmMasterDelete && <div className="wb-delete-confirm" role="alert"><span>Hapus {fmt(master.length)} data VEF Master? Riwayat scan tidak ikut dihapus.</span><div><button className="wb-delete-cancel" onClick={() => setConfirmMasterDelete(false)}>Batal</button><button className="wb-delete-confirm-action" onClick={deleteMaster}>Ya, hapus master</button></div></div>}<MasterTable rows={visibleMaster} /></>}
        {screen === 'Scan SN' && <>
          <section className="wb-scan-workbook-head">
            <div className="wb-scanner-title"><span><Barcode size={20} /></span><div><h2>Scan SN per Rack</h2><p>Isi nomor Rack secara manual di tiap kartu. Slot sumber VEF tetap digunakan untuk mencocokkan data.</p></div><i className="wb-scanner-ready"><i /> Scanner siap</i></div>
            <div className="wb-layout-row"><span>Slot sumber aktif</span><div>{Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => <button key={n} className={layout === n ? 'selected' : ''} onClick={() => { setLayout(n); setTimeout(() => scanRef.current?.focus(), 20) }}>{n}</button>)}</div><small>Nomor Rack dan target diisi di masing-masing kartu.</small></div>
          </section>
          <div className="wb-layout-viewport"><div className="wb-layout-grid">{Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => {
            const layoutScans = scans.filter((scan) => scan.layout === n)
            const foundCount = layoutScans.filter((scan) => scan.status === 'Found').length
            const masterCount = master.filter((item) => item.layout === n).length
            const targetQty = Number.parseInt(scanTargets[n] ?? '', 10)
            const targetReached = Number.isInteger(targetQty) && targetQty > 0 && foundCount >= targetQty
            return <section key={n} className={`wb-layout-card ${layout === n ? 'layout-current' : ''} ${scanStartedLayout === n ? 'layout-scanning' : ''} ${targetReached ? 'layout-target-reached' : ''}`} onClick={() => setLayout(n)}>
              <div className="wb-layout-card-head"><label className={`wb-layout-number wb-rack-number-edit ${targetReached ? 'rack-number-complete' : ''}`} onClick={(event) => event.stopPropagation()}><input type="text" inputMode="numeric" aria-label={`Nomor Rack slot sumber ${n}`} value={rackNumbers[n] ?? ''} disabled={scanStartedLayout === n} placeholder="No." onFocus={() => setLayout(n)} onChange={(event) => { const next = { ...rackNumbers, [n]: event.target.value }; setRackNumbers(next); try { localStorage.setItem('stokly-workbook-rack-numbers', JSON.stringify(next)) } catch { /* Optional rack persistence. */ } }} />{targetReached && <span className="wb-rack-complete-check" title="Target tercapai" aria-label="Target tercapai"><Check size={12} strokeWidth={3.5} /></span>}</label><div><h2>Rack {rackNumbers[n] || '—'}</h2><small>{masterCount ? `${fmt(masterCount)} unit di slot sumber ${n}` : `Slot sumber ${n}`}</small></div><span className="wb-layout-card-count"><b>{fmt(foundCount)}{scanTargets[n] ? ` / ${scanTargets[n]}` : ''}</b><small>{targetReached ? 'target tercapai' : scanStartedLayout === n ? 'berjalan' : 'scan valid'}</small></span></div>
              <div className="wb-layout-target" onClick={(event) => event.stopPropagation()}><label className="wb-target-quantity">Target qty<input type="number" min="1" step="1" inputMode="numeric" value={scanTargets[n] ?? ''} disabled={scanStartedLayout === n} placeholder="Qty" onFocus={() => setLayout(n)} onChange={(event) => { const next = { ...scanTargets, [n]: event.target.value }; setScanTargets(next); try { localStorage.setItem('stokly-workbook-scan-targets', JSON.stringify(next)) } catch { /* Optional target persistence. */ } }} /></label><small>{foundCount} / {scanTargets[n] || '—'} valid</small>{scanStartedLayout === n ? <button type="button" className="wb-layout-start-button is-running" onClick={() => finishScan(n)}>Selesaikan</button> : <button type="button" className="wb-layout-start-button" disabled={!rackNumbers[n]?.trim() || !scanTargets[n] || foundCount >= Number.parseInt(scanTargets[n] ?? '', 10)} onClick={() => startScan(n)}>Mulai scan</button>}</div>
              <form className="wb-layout-scan-form" onSubmit={(event) => { event.preventDefault(); const value = scanInputs[n] ?? ''; recordScan(value, n); setTimeout(() => document.getElementById(`layout-scan-${n}`)?.focus(), 20) }} onClick={(event) => event.stopPropagation()}>
                <label><ScanLine size={15} /><input id={`layout-scan-${n}`} ref={n === layout ? scanRef : undefined} autoComplete="off" disabled={scanStartedLayout !== n || foundCount >= Number.parseInt(scanTargets[n] ?? '', 10)} value={scanInputs[n] ?? ''} onFocus={() => setLayout(n)} onChange={(event) => setScanInputs((current) => ({ ...current, [n]: event.target.value }))} placeholder={scanStartedLayout !== n ? 'Isi nomor Rack dan mulai scan…' : `Pindai SN ke Rack ${rackNumbers[n]}…`} /><kbd>↵</kbd></label>
                <button type="submit" aria-label={`Catat scan ke layout ${n}`} disabled={scanStartedLayout !== n || foundCount >= Number.parseInt(scanTargets[n] ?? '', 10)}><Plus size={15} /></button>
              </form>
              <div className="wb-layout-scan-list">{layoutScans.length ? layoutScans.slice(0, 5).map((scan) => <div className="wb-layout-scan-row" key={scan.id}><span className="serial-cell">{scan.serial}</span><span className={`wb-status ${scan.status === 'Found' ? 'wb-status-ok' : scan.status === 'DUPLICATE' ? 'wb-status-duplicate' : 'wb-status-open'}`}><i />{scan.status}</span><button className="wb-delete" title="Hapus scan" onClick={(event) => { event.stopPropagation(); deleteScan(scan.id) }}><X size={13} /></button></div>) : <div className="wb-layout-empty">Belum ada SN dipindai</div>}</div>
              {layoutScans.length > 5 && <button className="wb-layout-more" onClick={(event) => { event.stopPropagation(); setLayout(n); changeScreen('Scan Result') }}>Lihat {layoutScans.length - 5} lainnya</button>}
            </section>
          })}</div></div>
          <div className="wb-scan-hints"><p><i className="hint-green"><Check size={13} /></i><span><b>Found</b>Serial ditemukan pada VEF Master.</span></p><p><i className="hint-amber"><AlertTriangle size={13} /></i><span><b>Not In VEF</b>Serial tidak terdapat pada master.</span></p><p><i className="hint-red"><X size={13} /></i><span><b>Duplicate</b>Serial yang sama sudah pernah dipindai.</span></p></div>
        </>}
        {screen === 'Scan Result' && <><div className="wb-result-cards"><div><span className="dot-found" />Found <b>{counts.found}</b></div><div><span className="dot-issue" />Not In VEF <b>{counts.unknown}</b></div><div><span className="dot-duplicate" />Duplicate <b>{counts.duplicate}</b></div></div><div className="wb-table-tools"><label><Search size={15} /><input placeholder="Cari serial, item code, status…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><button className="wb-button wb-button-light" onClick={exportCurrent}><ArrowDownToLine size={15} /> Ekspor</button></div><ScanTable scans={visibleScans} onDelete={deleteScan} title={`Semua hasil scan · ${visibleScans.length} baris`} onView={() => {}} /></>}
        {(screen === 'Reconciliation' || screen === 'Recap') && <><section className="wb-recon-summary"><div><span>Total VEF</span><b>{fmt(counts.qty)}</b></div><div><span>Valid unique scan</span><b className="positive">{fmt(counts.matched)}</b></div><div><span>Belum ditemukan</span><b className="negative">{fmt(counts.missing)}</b></div><div><span>Not In VEF / Duplicate</span><b className="warning">{fmt(counts.unknown + counts.duplicate)}</b></div></section><div className="wb-table-tools"><label><Search size={15} /><input placeholder="Cari item code, item name…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><button className="wb-button wb-button-light" onClick={exportCurrent}><ArrowDownToLine size={15} /> Ekspor rekap</button></div><div className="wb-table-shell"><div className="wb-table-label"><div><h2>{screen === 'Recap' ? 'REKAP SELISIH' : 'Reconciliation per Item Code'}</h2><p>Selisih = Total VEF − (Total Scan + Box + PJ). Isi Box dan PJ sebagai jumlah unit.</p></div><span>{recapRows.length} item code</span></div><div className="wb-table-scroll"><table className="wb-table"><thead><tr><th>NO</th><th>ITEM CODE</th><th>ITEM NAME</th><th>BRAND</th><th>WAREHOUSE</th><th>TOTAL VEF</th><th>TOTAL SCAN</th><th>BOX (QTY)</th><th>PJ (QTY)</th><th>SELISIH</th><th>STATUS</th></tr></thead><tbody>{recapRows.map((r, index) => <tr key={`${r.code}-${r.warehouse}`}><td>{index + 1}</td><td><b className="code-cell">{r.code}</b></td><td>{r.name || '—'}</td><td>{r.brand || '—'}</td><td>{r.warehouse || '—'}</td><td>{fmt(r.total)}</td><td>{fmt(r.scanned)}</td><td><input type="number" min="0" step="1" className="wb-recon-manual-input" aria-label={`Jumlah Box untuk ${r.code}`} placeholder="0" value={r.box} onFocus={() => { manualEditStart.current = r.box }} onBlur={() => { if (manualEditStart.current !== null && manualEditStart.current !== r.box) recordManualActivity(r, 'box', r.box); manualEditStart.current = null }} onChange={(event) => updateRecapField(r, 'box', event.target.value)} /></td><td><input type="number" min="0" step="1" className="wb-recon-manual-input" aria-label={`Jumlah PJ untuk ${r.code}`} placeholder="0" value={r.pj} onFocus={() => { manualEditStart.current = r.pj }} onBlur={() => { if (manualEditStart.current !== null && manualEditStart.current !== r.pj) recordManualActivity(r, 'pj', r.pj); manualEditStart.current = null }} onChange={(event) => updateRecapField(r, 'pj', event.target.value)} /></td><td><b className={r.missing > 0 ? 'negative' : r.missing < 0 ? 'warning' : 'positive'}>{formatDifference(r.missing)}</b></td><td><span className={`wb-status ${r.missing > 0 ? 'wb-status-open' : r.missing < 0 ? 'wb-status-duplicate' : 'wb-status-ok'}`}><i />{r.missing > 0 ? 'Belum lengkap' : r.missing < 0 ? 'Lebih jumlah' : 'Match'}</span></td></tr>)}</tbody></table>{!recapRows.length && <Empty text={screen === 'Recap' ? 'Tidak ada item yang masih selisih.' : 'Master VEF belum tersedia. Muat workbook untuk membuat rekonsiliasi.'} />}</div><div className="wb-table-footer">Menampilkan {recapRows.length} item code dari master · Box dan PJ tersimpan otomatis</div></div></>}
        <footer className="wb-footer"><span>Stock opname by serial number</span><span><i /> Data tersimpan otomatis pada perangkat</span></footer>
      </div>
    </main>
    {toast && <div className="wb-toast"><span><CheckCircle2 size={17} /></span>{toast}<button onClick={() => setToast('')} aria-label="Tutup"><X size={15} /></button></div>}
  </div>
}

function MissingItemsTable({ rows }: { rows: Array<{ code: string; name: string; warehouse: string; total: number; scanned: number; box: string; pj: string; missing: number }> }) {
  return <div className="wb-table-shell wb-missing-items"><div className="wb-table-label"><div><h2>Item yang masih minus</h2><p>Daftar item yang belum terpenuhi setelah scan, Box, dan PJ diperhitungkan.</p></div><span>{rows.length} item</span></div><div className="wb-table-scroll"><table className="wb-table"><thead><tr><th>NO</th><th>ITEM CODE</th><th>ITEM NAME</th><th>WAREHOUSE</th><th>TOTAL VEF</th><th>TOTAL TERHITUNG</th><th>SELISIH</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.code}-${row.warehouse}`}><td>{index + 1}</td><td><b className="code-cell">{row.code}</b></td><td>{row.name || '—'}</td><td>{row.warehouse || '—'}</td><td>{fmt(row.total)}</td><td>{fmt(row.scanned + qty(row.box) + qty(row.pj))}</td><td><b className="negative">{formatDifference(row.missing)}</b></td></tr>)}</tbody></table>{!rows.length && <Empty text="Tidak ada item yang masih minus." />}</div></div>
}

function MasterTable({ rows }: { rows: Master[] }) {
  return <div className="wb-table-shell"><div className="wb-table-label"><div><h2>Data master VEF</h2><p>Kolom sumber: Item Code · Serial No · Brand · Warehouse · Item Name</p></div><span>{fmt(rows.length)} unit</span></div><div className="wb-table-scroll"><table className="wb-table"><thead><tr><th>NO</th><th>ITEM CODE</th><th>SERIAL NO</th><th>BRAND</th><th>WAREHOUSE</th><th>ITEM NAME</th></tr></thead><tbody>{rows.map((row, i) => <tr key={`${row.serial}-${i}`}><td>{i + 1}</td><td><b className="code-cell">{row.code || '—'}</b></td><td className="serial-cell">{row.serial || '—'}</td><td>{row.brand || '—'}</td><td>{row.warehouse || '—'}</td><td>{row.name || '—'}</td></tr>)}</tbody></table>{!rows.length && <Empty text="Belum ada data master VEF." />}</div></div>
}
function ScanTable({ scans, onDelete, title, onView }: { scans: Scan[]; onDelete: (id: string) => void; title: string; onView: () => void }) {
  return <div className="wb-table-shell"><div className="wb-table-label"><div><h2>{title}</h2><p>Setiap serial divalidasi terhadap sheet VEF Master.</p></div><button className="wb-link" onClick={onView}>Lihat semua →</button></div><div className="wb-table-scroll"><table className="wb-table"><thead><tr><th>SERIAL NO</th><th>ITEM CODE</th><th>ITEM NAME</th><th>BRAND</th><th>RACK</th><th>STATUS</th><th>WAKTU</th><th /></tr></thead><tbody>{scans.map((scan) => <tr key={scan.id}><td className="serial-cell">{scan.serial}</td><td><b className="code-cell">{scan.item?.code ?? '—'}</b></td><td>{scan.item?.name ?? 'Tidak ditemukan di master'}</td><td>{scan.item?.brand ?? '—'}</td><td><span className="layout-tag">{scan.rack ?? scan.layout}</span></td><td><span className={`wb-status ${scan.status === 'Found' ? 'wb-status-ok' : scan.status === 'DUPLICATE' ? 'wb-status-duplicate' : 'wb-status-open'}`}><i />{scan.status}</span></td><td>{scan.time}</td><td><button className="wb-delete" title="Hapus scan" onClick={() => onDelete(scan.id)}><X size={14} /></button></td></tr>)}</tbody></table>{!scans.length && <Empty text="Belum ada serial number dipindai. Mulai scan untuk mencatat unit." />}</div>{scans.length > 0 && <div className="wb-table-footer">Menampilkan {scans.length} hasil scan</div>}</div>
}
function ActivityHistory({ events, onView }: { events: HistoryEvent[]; onView: () => void }) {
  return <div className="wb-table-shell"><div className="wb-table-label"><div><h2>Riwayat 10 aktivitas terakhir</h2><p>Termasuk pemindaian SN dan pengisian jumlah Box/PJ.</p></div><button className="wb-link" onClick={onView}>Lihat semua scan →</button></div><div className="wb-table-scroll"><table className="wb-table"><thead><tr><th>NO</th><th>AKTIVITAS</th><th>DETAIL</th><th>STATUS</th><th>WAKTU</th></tr></thead><tbody>{events.map((event, index) => <tr key={event.id}><td>{index + 1}</td><td>{event.title}</td><td>{event.detail}</td><td>{event.status ? <span className={`wb-status ${event.status === 'Found' ? 'wb-status-ok' : event.status === 'DUPLICATE' ? 'wb-status-duplicate' : 'wb-status-open'}`}><i />{event.status}</span> : <span className="wb-status wb-status-ok"><i />Tersimpan</span>}</td><td>{event.time}</td></tr>)}</tbody></table>{!events.length && <Empty text="Belum ada aktivitas scan atau pengisian Box/PJ." />}</div>{events.length > 0 && <div className="wb-table-footer">Menampilkan {events.length} aktivitas terbaru</div>}</div>
}
function Empty({ text }: { text: string }) { return <div className="wb-empty"><ScanLine size={23} /><span>{text}</span></div> }
