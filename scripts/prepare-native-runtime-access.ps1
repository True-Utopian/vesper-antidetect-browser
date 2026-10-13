[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
$runtimeDirectory = Get-Item -LiteralPath $Directory
if (!$runtimeDirectory.PSIsContainer -or ($runtimeDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Native runtime access requires a real directory, not a reparse point'
}
if (@(Get-ChildItem -LiteralPath $runtimeDirectory.FullName -Force).Count -ne 0) {
    throw 'Prepare sandbox access only on a fresh empty runtime directory'
}
# Chromium's Windows LPAC subprocesses need read/execute on the runtime.
# Apply this only to the newly created binary directory, never profile data.
$acl = Get-Acl -LiteralPath $runtimeDirectory.FullName
$before = $acl.Sddl
$principal = [Security.Principal.SecurityIdentifier]::new('S-1-15-2-2')
$rule = [Security.AccessControl.FileSystemAccessRule]::new(
    $principal,
    [Security.AccessControl.FileSystemRights]::ReadAndExecute,
    ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),
    [Security.AccessControl.PropagationFlags]::None,
    [Security.AccessControl.AccessControlType]::Allow)
[void]$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $runtimeDirectory.FullName -AclObject $acl
$after = Get-Acl -LiteralPath $runtimeDirectory.FullName
$matching = @($after.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | Where-Object {
    $_.IdentityReference.Value -eq 'S-1-15-2-2' -and
    $_.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
    ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]::ReadAndExecute) -eq [Security.AccessControl.FileSystemRights]::ReadAndExecute
})
if ($matching.Count -eq 0) { throw 'Native runtime sandbox access was not applied' }
@{directory=$runtimeDirectory.FullName;principal='S-1-15-2-2';rights='ReadAndExecute';beforeSddl=$before;afterSddl=$after.Sddl} | ConvertTo-Json
