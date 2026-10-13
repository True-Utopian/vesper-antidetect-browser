!macro customInstall
  ; Read/execute for Chromium's restricted sandbox processes, only on binaries.
  ; Profile data and the rest of the installation keep their existing ACLs.
  Push $R0
  Push $R1
  nsExec::ExecToStack '"$SYSDIR\icacls.exe" "$INSTDIR\resources\vesper-kernel" /grant "*S-1-15-2-2:(OI)(CI)(RX)" /T /Q'
  Pop $R0
  Pop $R1
  ${If} $R0 != 0
    DetailPrint "Could not prepare Vesper kernel sandbox access: $R1"
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "Vesper could not prepare its browser sandbox. Installation cannot complete."
    ${EndIf}
    SetErrorLevel 1
    Quit
  ${EndIf}
  Pop $R1
  Pop $R0
!macroend
