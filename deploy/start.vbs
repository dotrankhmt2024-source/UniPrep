' ============================================================
'  UniPrep - Start backend (Nest :3000) + frontend (Vite :5173)
'  Chay detached: tien trinh song tiep sau khi runner/script ket thuc.
'  Moi service ghi log RIENG (khong dung chung file: cmd giu handle
'  nen tien trinh thu hai se khong mo duoc file va thoat im lang).
'  Args: /silent
' ============================================================
Option Explicit

Dim fso, sh, root, logDir, logBackend, logFrontend, backendDir, frontendDir, tunnel

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

' root = thu muc UniPrep (cha cua deploy\)
root        = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
logDir      = root & "\deploy"
logBackend  = logDir & "\backend.log"
logFrontend = logDir & "\frontend.log"
backendDir  = root & "\backend"
frontendDir = root & "\frontend"
tunnel      = "D:\PhanLeThien\tunnel\deploy\ensure.vbs"

If Not fso.FolderExists(backendDir) Then
  WScript.Echo "Thieu thu muc backend: " & backendDir
  WScript.Quit 1
End If

If Not fso.FolderExists(frontendDir) Then
  WScript.Echo "Thieu thu muc frontend: " & frontendDir
  WScript.Quit 1
End If

' --- Backend: dist da build san boi deploy.bat ---
sh.Run "cmd /c cd /d """ & backendDir & """ && node dist\main.js >> """ & logBackend & """ 2>&1", 0, False

' --- Frontend: Vite dev server (giu nguyen mo hinh hien tai) ---
sh.Run "cmd /c cd /d """ & frontendDir & """ && npm run dev >> """ & logFrontend & """ 2>&1", 0, False

' --- Tunnel dung chung (idempotent, da chay thi no-op) ---
If fso.FileExists(tunnel) Then
  sh.Run "wscript.exe //B """ & tunnel & """ /silent", 0, True
End If

WScript.Quit 0
