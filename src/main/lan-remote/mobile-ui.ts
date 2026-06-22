export function getLanRemoteMobileHtml(sessionToken: string | null = null): string {
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
    <input id="jumpIndex" type="number" min="1" value="1" aria-label="Jump item number">
    <button data-command="presentation:jump">Jump</button>
    <button data-command="projection:blank">Blank</button>
    <button data-command="projection:unblank">Unblank</button>
    <button data-command="timer:start">Start Timer</button>
    <button data-command="timer:pause">Pause Timer</button>
    <button data-command="timer:reset">Reset Timer</button>
    <button data-command="stopwatch:start">Start Stopwatch</button>
    <button data-command="stopwatch:pause">Pause Stopwatch</button>
    <button data-command="stopwatch:reset">Reset Stopwatch</button>
    <pre id="state">Disconnected</pre>
  </main>
  <script>
    const state = document.getElementById('state')
    const sessionToken = ${JSON.stringify(sessionToken)}
    async function postCommand(type) {
      const command = type.startsWith('timer:')
        ? { requestId: crypto.randomUUID(), type: 'timer:command', command: { type: type.slice(6) } }
        : type.startsWith('stopwatch:')
          ? { requestId: crypto.randomUUID(), type: 'timer:command', command: { type: type.slice(10) + 'Stopwatch' } }
          : type === 'presentation:jump'
            ? { requestId: crypto.randomUUID(), type, index: Math.max(0, Number(document.getElementById('jumpIndex').value) - 1) }
          : { requestId: crypto.randomUUID(), type: type.replace(':unblank', ':blank'), enabled: type !== 'projection:unblank' }
      const response = await fetch('/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-libre-presenter-session': sessionToken },
        body: JSON.stringify(command)
      })
      state.textContent = JSON.stringify(await response.json(), null, 2)
    }
    async function refreshState() {
      const response = await fetch('/state', { headers: { 'x-libre-presenter-session': sessionToken } })
      state.textContent = JSON.stringify(await response.json(), null, 2)
    }
    document.querySelectorAll('button').forEach(button => {
      button.onclick = () => postCommand(button.dataset.command).catch(error => {
        state.textContent = error.message
      })
    })
    setInterval(() => refreshState().catch(() => {}), 1000)
    refreshState().catch(error => { state.textContent = error.message })
  </script>
</body>
</html>`
}
