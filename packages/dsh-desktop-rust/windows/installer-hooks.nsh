; The desktop host owns a bundled Node sidecar. Tauri's default NSIS template
; stops only the main executable, so forcibly closing the host can orphan
; dsh-node.exe and leave the runtime executable and native DLLs locked.
;
; Stop the sidecar before install/uninstall touches the runtime tree. Recheck
; after termination and fail closed instead of allowing a partial installation.
!macro DSH_STOP_SIDECAR suffix
  DetailPrint "Stopping the DSH Desktop runtime..."
  nsis_tauri_utils::FindProcessCurrentUser "dsh-node.exe"
  Pop $R0

  ${If} $R0 = 0
    nsis_tauri_utils::KillProcessCurrentUser "dsh-node.exe"
    Pop $R0
    Sleep 1000

    nsis_tauri_utils::FindProcessCurrentUser "dsh-node.exe"
    Pop $R0
    ${If} $R0 = 0
      DetailPrint "DSH Desktop runtime is still running; aborting to protect the installation."
      IfSilent dsh_sidecar_abort_${suffix} 0
      ${If} $PassiveMode != 1
        MessageBox MB_ICONSTOP|MB_OK "DSH Desktop is still running. Close it from the system tray or Task Manager, then run the installer again."
      ${EndIf}
      dsh_sidecar_abort_${suffix}:
        Abort "DSH Desktop runtime is still running."
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro DSH_STOP_SIDECAR install
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro DSH_STOP_SIDECAR uninstall
!macroend
