param([int]$Port, [int]$TimeoutSec = 120, [string]$Url = '')
# Windows. Opens $Url in the browser once it is listening, then waits for one browser request to
# http://127.0.0.1:<Port>/callback?... and prints its path and query.
# Exit codes: 0 got the callback, 2 the port is taken (the browser is not opened), 3 nobody came in time.
try {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
  $listener.Start()
} catch {
  [Console]::Error.WriteLine("bind failed: $($_.Exception.Message)")
  exit 2
}
if ($Url) { Start-Process $Url }
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$result = $null
try {
  while (-not $result -and (Get-Date) -lt $deadline) {
    if (-not $listener.Pending()) { Start-Sleep -Milliseconds 50; continue }
    $client = $listener.AcceptTcpClient()
    try {
      # Browsers open spare connections that send nothing, so give up on a silent one after 2 s.
      $client.ReceiveTimeout = 2000
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII)
      $line = $null
      try { $line = $reader.ReadLine() } catch {}
      if ($line -and $line -match '^GET (/callback\?\S+) HTTP') {
        $result = $Matches[1]
        $status = '200 OK'
        $body = '<html><body style="font-family:sans-serif"><h3>Signed in. You can close this tab and go back to Herdr.</h3></body></html>'
      } else {
        $status = '404 Not Found'
        $body = ''
      }
      $bytes = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: text/html`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n$body")
      try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush() } catch {}
    } finally { $client.Close() }
  }
} finally { $listener.Stop() }
if ($result) { [Console]::Out.WriteLine($result); exit 0 }
[Console]::Error.WriteLine('timed out')
exit 3
