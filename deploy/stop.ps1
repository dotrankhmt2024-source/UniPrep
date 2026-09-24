# UniPrep - dung backend (:3000) + frontend (:5173)
# Dung theo port dang listen, khong doan theo ten process.

$ports = 5173, 3000
$killed = 0

foreach ($p in $ports) {
    $procIds = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique

    if (-not $procIds) {
        Write-Host "  port $p -> dang trong"
        continue
    }

    foreach ($procId in $procIds) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.ProcessName } else { 'unknown' }
        Write-Host "  port $p -> kill PID $procId ($name)"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        $killed++
    }
}

Start-Sleep -Seconds 2
Write-Host "[UniPrep] Da dung $killed process."
exit 0
