# Codex compatibility installer (secondary path).
# Usage: .\scripts\install-codex.ps1 [target-directory]

param(
    [Parameter(Position=0)]
    [string]$TargetDir = "."
)

$ScriptDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

New-Item -ItemType Directory -Path "$TargetDir\.agents\skills" -Force | Out-Null
New-Item -ItemType Directory -Path "$TargetDir\.codex\agents" -Force | Out-Null

Copy-Item -Path "$ScriptDir\plugin\skills\*" -Destination "$TargetDir\.agents\skills" -Recurse -Force
Copy-Item -Path "$ScriptDir\plugin\codex\agents\*" -Destination "$TargetDir\.codex\agents" -Recurse -Force

Write-Host "Installed skills to $TargetDir\.agents\skills"
Write-Host "Installed Codex agents to $TargetDir\.codex\agents"
Write-Host "This is the Codex compatibility path. The primary onboarding flow is the Claude plugin."
Write-Host "Rerun this script after updating plugin/skills or plugin/codex/agents."
