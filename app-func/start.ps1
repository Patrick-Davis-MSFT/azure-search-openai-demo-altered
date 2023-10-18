Write-Host ""
Write-Host "Indexing function... " 
Write-Host "Loading azd .env file from current environment"
Write-Host ""

deactivate


foreach ($line in (& azd env get-values)) {
    if ($line -match "([^=]+)=(.*)") {
        $key = $matches[1]
        $value = $matches[2] -replace '^"|"$'
        Set-Item -Path "env:\$key" -Value $value
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to load environment variables from azd environment"
    exit $LASTEXITCODE
}


Write-Host 'Creating python virtual environment "/func_env"'
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
  # fallback to python3 if python not found
  $pythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
}
Start-Process -FilePath ($pythonCmd).Source -ArgumentList "-m venv ./func_env" -Wait -NoNewWindow

Write-Host ""
Write-Host "Restoring backend python packages"
Write-Host ""

$venvPythonPath = "./func_env/scripts/python.exe"
$venvFuncPath = "./func"
if (Test-Path -Path "/usr") {
  # fallback to Linux venv path
  $venvPythonPath = "./func_env/bin/python"
  $venvFuncPath = "./func_env/bin/func"
}

Start-Process -FilePath $venvPythonPath -ArgumentList "-m pip install -r requirements.txt" -Wait -NoNewWindow
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to restore backend python packages"
    exit $LASTEXITCODE
}

#Set-Location ../backend
.\func_env\scripts\Activate.ps1
func start --debug --verbose --build local --port 7071
#Start-Process -FilePath $venvFuncPath -ArgumentList "start --debug" -Wait -NoNewWindow

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start backend"
    exit $LASTEXITCODE
}
