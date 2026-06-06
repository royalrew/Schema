$root = $PSScriptRoot

Start-Process powershell -ArgumentList '-NoExit', '-Command', "
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned;
  & '$root\.venv\Scripts\Activate.ps1';
  cd '$root\apps\api';
  uvicorn app.main:app --reload --port 9000
"

Start-Process powershell -ArgumentList '-NoExit', '-Command', "
  cd '$root\apps\web';
  npm run dev
"
