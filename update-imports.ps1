# PowerShell script to update component import paths

$files = Get-ChildItem -Path "d:\Coding\personal\twinkforsale\src" -Recurse -Include "*.tsx", "*.ts" | Where-Object { $_.Name -ne "update-imports.ps1" }

$replacements = @{
    'from "~/components/analytics-chart/analytics-chart"' = 'from "~/components/charts/analytics-chart"'
    'from "~/components/detailed-analytics-chart/detailed-analytics-chart"' = 'from "~/components/charts/detailed-analytics-chart"'
    'from "~/components/user-analytics/user-analytics"' = 'from "~/components/charts/user-analytics"'
    'from "~/components/theme-toggle/theme-toggle"' = 'from "~/components/ui/theme-toggle"'
    'from "~/components/icon-selector/icon-selector"' = 'from "~/components/ui/icon-selector"'
    'from "~/components/gradient-config-panel/gradient-config-panel"' = 'from "~/components/ui/gradient-config-panel"'
    'from "~/components/particle-config-panel/particle-config-panel"' = 'from "~/components/ui/particle-config-panel"'
    'from "~/components/particle-background/particle-background"' = 'from "~/components/effects/particle-background"'
    'from "~/components/heart-particles/heart-particles"' = 'from "~/components/effects/heart-particles"'
    'from "~/components/bio-link-icon/bio-link-icon"' = 'from "~/components/bio/bio-link-icon"'
    'from "~/components/discord-profile/discord-profile"' = 'from "~/components/bio/discord-profile"'
    'from "~/components/lazy-image"' = 'from "~/components/file-type-icon"'
    'from "./components/router-head/router-head"' = 'from "./components/router-head"'
    'from "./components/alert"' = 'from "./components/alert"'
}

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    foreach ($old in $replacements.Keys) {
        $new = $replacements[$old]
        $content = $content -replace [regex]::Escape($old), $new
    }
    
    if ($content -ne $originalContent) {
        Set-Content $file.FullName -Value $content -NoNewline
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "Import path update complete!"
