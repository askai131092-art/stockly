import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)))
const port = Number(process.env.PORT) || 5173
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const filePath = relativePath === 'SO by SN Master Toko.xlsx'
      ? resolve(root, '..', relativePath)
      : resolve(root, relativePath)
    const isAttachedWorkbook = relativePath === 'SO by SN Master Toko.xlsx' && filePath === resolve(root, '..', relativePath)
    if (filePath !== root && !filePath.startsWith(root + sep) && !isAttachedWorkbook) {
      response.writeHead(403).end('Forbidden')
      return
    }

    if (extname(filePath) === '.tsx') {
      const source = await readFile(filePath, 'utf8')
      const output = ts.transpileModule(source, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
      }).outputText.replace(/(from\s*['"])(\.\/?[^'"]+)(['"])/g, (_match, before, specifier, after) =>
        `${before}${extname(specifier) ? specifier : `${specifier}.tsx`}${after}`,
      )
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }).end(output)
      return
    }

    if (extname(filePath) === '.ts') {
      const source = await readFile(filePath, 'utf8')
      const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }).end(output)
      return
    }

    const details = await stat(filePath)
    if (!details.isFile()) throw new Error('Not a file')
    response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' })
    response.end(await readFile(filePath))
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found')
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Stokly siap dibuka di http://localhost:${port}`)
})