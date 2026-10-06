$mh = "$env:DSH_HOME\dsh-mind"
$lines = Get-Content "$mh\timeline.jsonl" -Encoding UTF8
$inv = [System.Globalization.CultureInfo]::InvariantCulture
function TsOf($j) {
  if ($j.ts -is [datetime]) { return $j.ts.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', $inv) }
  return [string]$j.ts
}
$wakes = @($lines | ForEach-Object { try { $j = $_ | ConvertFrom-Json; $t = TsOf $j; if ($j.type -eq 'wake' -and [string]::CompareOrdinal($t, '2026-10-05T14:30') -ge 0) { $o = New-Object PSObject -Property @{ ts = $t; fn = $j.fn; trig = $j.trigger; final = $j.final; content = $j.content }; $o } } catch {} })
Write-Output ("WAKE_COUNT=" + $wakes.Count)
Write-Output "=== FULL FINALS ==="
$i = 0
foreach ($w in $wakes) {
  $i++
  $f = $w.final
  if (-not $f) { $f = $w.content }
  Write-Output ("--- [" + $i + "] " + $w.ts + " fn=" + $w.fn + " trig=" + $w.trig + " ---")
  if ($f.Length -gt 650) { Write-Output ($f.Substring(0, 650) + " ...[LEN=" + $f.Length + "]") } else { Write-Output $f }
  Write-Output ""
}
Write-Output "=== THOUGHTS/OBSERVATIONS ==="
$thoughts = @($lines | ForEach-Object { try { $j = $_ | ConvertFrom-Json; $t = TsOf $j; if (($j.type -eq 'thought' -or $j.type -eq 'observation') -and [string]::CompareOrdinal($t, '2026-10-05T14:30') -ge 0) { $o = New-Object PSObject -Property @{ ts = $t; type = $j.type; content = $j.content }; $o } } catch {} })
Write-Output ("THOUGHT_COUNT=" + $thoughts.Count)
$k = 0
foreach ($t in $thoughts) {
  $k++
  if ($k -gt ($thoughts.Count - 12)) {
    $c = $t.content
    if ($c -and $c.Length -gt 600) { $c = $c.Substring(0, 600) + " ...[LEN=" + $t.content.Length + "]" }
    Write-Output ("--- [" + $k + "] " + $t.ts + " " + $t.type + " ---")
    Write-Output $c
    Write-Output ""
  }
}
