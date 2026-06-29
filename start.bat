@echo off

:: Start backend
start "TMS Backend" cmd /k "cd /d C:\Users\rishi\OneDrive\Desktop\Internship\TMS backend && venv\Scripts\activate && uvicorn app.main:app --reload"

:: Start frontend
start "TMS Frontend" cmd /k "cd /d C:\Users\rishi\OneDrive\Desktop\Internship\TMS frontend && npm run dev"

:: Open browser after a short delay
timeout /t 4 /nobreak >nul
start http://localhost:5173