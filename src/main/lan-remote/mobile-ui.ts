export function getLanRemoteMobileHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LibrePresenter Remote</title>
  <style>
    body{font-family:system-ui;margin:0;background:#111;color:#fff}
    main{display:grid;gap:12px;padding:16px}
    button{font-size:20px;padding:16px;border-radius:10px;border:0}
  </style>
</head>
<body>
  <main>
    <button data-command="presentation:prev">Previous</button>
    <button data-command="presentation:next">Next</button>
    <button data-command="projection:blank">Blank</button>
    <pre id="state">Disconnected</pre>
  </main>
  <script>
    const state = document.getElementById('state')
    const ws = new WebSocket(location.origin.replace('http', 'ws') + '/ws')
    ws.onmessage = event => { state.textContent = event.data }
    document.querySelectorAll('button').forEach(button => {
      button.onclick = () => ws.send(JSON.stringify({
        requestId: crypto.randomUUID(),
        type: button.dataset.command,
        enabled: true
      }))
    })
  </script>
</body>
</html>`
}
