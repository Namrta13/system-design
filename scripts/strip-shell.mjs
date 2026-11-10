// The artifact host adds its own <html>/<head>/<body>, so keep only the page's own tags.
import { readFileSync, writeFileSync } from 'node:fs'
const file = 'dist-preview/concepts/load-balancer.html'
const html = readFileSync(file, 'utf8')
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '')
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1]
writeFileSync('dist-preview/load-balancer-preview.html', head.trim() + '\n' + body.trim() + '\n')
