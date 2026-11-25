# Builds the Windows installer for Staff & Strings with the C# compiler that ships with Windows
# (.NET Framework 4), so nothing extra needs installing.
# Usage (PowerShell, from anywhere):  .\windows\build-exe.ps1 -Version 0.22.0 [-SkipWebBuild]
# Output: dist\GuitarReadingTrainer-Setup-v<Version>.exe, one file (about 2 MB) holding the launcher,
# the single-file app, the icon and the licence. See windows\Setup.cs for what it installs.
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [switch]$SkipWebBuild
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$Win = $PSScriptRoot
$Csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $Csc)) { $Csc = "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe" }
if (-not (Test-Path $Csc)) { throw 'The .NET Framework 4 C# compiler (csc.exe) was not found.' }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" } }

$parts = $Version.Split('.')
if ($parts.Count -ne 3) { throw "Version must be major.minor.patch, got $Version" }
$NumericVersion = "$Version.0"

# 1. The single-file page.
Push-Location $Root
try {
  if (-not $SkipWebBuild) {
    cmd /c "npx vite build 2>&1" | Out-Host; Check 'vite build'
    node tools\single-file.mjs | Out-Host; Check 'single-file'
  }
} finally { Pop-Location }
$Html = "$Root\dist\guitar-reading-trainer.html"
if (-not (Select-String -Path $Html -Pattern ([regex]::Escape($Version)) -Quiet)) { throw "dist\guitar-reading-trainer.html is not version ${Version}: build the web app first or drop -SkipWebBuild." }

$B = "$Win\build"
if (Test-Path $B) { Remove-Item $B -Recurse -Force }
New-Item -ItemType Directory $B | Out-Null

# 2. Icon and version details (shown in the file's Properties and in Settings > Apps).
& "$Win\make-icon.ps1" -Out "$B\app.ico"
Move-Item "$B\app.png" "$B\icon-256.png"
function Info($title, $description) {
  @"
using System.Reflection;
[assembly: AssemblyTitle("$title")]
[assembly: AssemblyDescription("$description")]
[assembly: AssemblyProduct("Staff & Strings")]
[assembly: AssemblyCompany("Dirk Swanepoel")]
[assembly: AssemblyCopyright("Copyright 2026 Dirk Swanepoel. PolyForm Noncommercial License 1.0.0")]
[assembly: AssemblyVersion("$NumericVersion")]
[assembly: AssemblyFileVersion("$NumericVersion")]
[assembly: AssemblyInformationalVersion("$Version")]
static class BuildInfo { public const string Version = "$Version"; }
"@
}
Set-Content -Path "$B\LauncherInfo.cs" -Value (Info 'Staff & Strings' 'Learn to read music on guitar or bass') -Encoding UTF8
Set-Content -Path "$B\SetupInfo.cs" -Value (Info 'Staff & Strings Setup' 'Installs, updates and removes Staff & Strings') -Encoding UTF8

$Common = @('/nologo', '/target:winexe', '/codepage:65001', '/optimize+', '/platform:anycpu', "/win32icon:$B\app.ico", "/win32manifest:$Win\app.manifest",
  '/r:System.dll', '/r:System.Core.dll', '/r:System.Drawing.dll', '/r:System.Windows.Forms.dll')

# 3. The launcher.
& $Csc @Common "/out:$B\launcher.exe" "$Win\Launcher.cs" "$B\LauncherInfo.cs" | Out-Host; Check 'csc launcher'

# 4. The setup, with the launcher, the app, the icon and the licence inside it.
New-Item -ItemType Directory -Force "$Root\dist" | Out-Null
$Out = "$Root\dist\GuitarReadingTrainer-Setup-v$Version.exe"
& $Csc @Common '/r:System.Management.dll' "/out:$Out" `
  "/resource:$B\launcher.exe,launcher.exe" "/resource:$Html,app.html" "/resource:$Root\LICENSE.md,LICENSE.md" `
  "/resource:$B\app.ico,app.ico" "/resource:$B\icon-256.png,icon-256.png" `
  "$Win\Setup.cs" "$B\SetupInfo.cs" | Out-Host; Check 'csc setup'

$size = (Get-Item $Out).Length
Write-Host "Built $Out ($size bytes)"
