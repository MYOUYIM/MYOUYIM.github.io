param(
    [Parameter(Mandatory = $true)]
    [string]$SourceHtml,

    [Parameter(Mandatory = $true)]
    [string]$RepoPath
)

$ErrorActionPreference = "Stop"

function Stop-WithError {
    param([string]$Message)
    Write-Host "`n[ERROR] $Message" -ForegroundColor Red
    exit 1
}

# 1. 检查输入文件
try {
    $SourceHtml = (Resolve-Path -LiteralPath $SourceHtml).Path
    $RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path
}
catch {
    Stop-WithError "源 HTML 或仓库路径不存在。"
}

if (-not (Test-Path -LiteralPath $SourceHtml -PathType Leaf)) {
    Stop-WithError "源文件不是有效文件。"
}

if ([IO.Path]::GetExtension($SourceHtml) -ne ".html") {
    Stop-WithError "只允许输入 .html 文件。"
}

if ((Get-Item -LiteralPath $SourceHtml).Length -eq 0) {
    Stop-WithError "源 HTML 文件为空。"
}

# 2. 检查 Git 仓库
if (-not (Test-Path (Join-Path $RepoPath ".git"))) {
    Stop-WithError "指定目录不是 Git 仓库。"
}

# 3. 检查 StatiCrypt
$Staticrypt = Get-Command staticrypt -ErrorAction SilentlyContinue

if (-not $Staticrypt) {
    Stop-WithError "没有检测到 StatiCrypt，请先安装并确认命令可用。"
}

# 4. 检查 Git 命令
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Stop-WithError "没有检测到 Git。"
}

# 5. 检查源文件是否位于仓库内
$RepoPrefix = $RepoPath.TrimEnd(
    [IO.Path]::DirectorySeparatorChar,
    [IO.Path]::AltDirectorySeparatorChar
) + [IO.Path]::DirectorySeparatorChar

$SourceFull = [IO.Path]::GetFullPath($SourceHtml)

if ($SourceFull.StartsWith(
    $RepoPrefix,
    [StringComparison]::OrdinalIgnoreCase
)) {
    $RelativeSource = $SourceFull.Substring($RepoPrefix.Length)
    $IgnoreResult = git -C $RepoPath check-ignore -q -- $RelativeSource

    if ($LASTEXITCODE -ne 0) {
        Stop-WithError "源 HTML 位于仓库内，但没有被 .gitignore 忽略。请先移出仓库或添加正确的忽略规则。"
    }
}

# 6. 创建随机文件名和临时目录
$Token = [guid]::NewGuid().ToString("N")
$AccessDir = Join-Path $RepoPath "access"
$TempDir = Join-Path $env:TEMP "member-build-$Token"
$OutputFile = Join-Path $AccessDir "$Token.html"

New-Item -ItemType Directory -Force $AccessDir | Out-Null
New-Item -ItemType Directory -Force $TempDir | Out-Null

try {
    # 7. 执行加密
    Write-Host "`n=== StatiCrypt 加密 ===" -ForegroundColor Cyan
    Write-Host "请在 StatiCrypt 提示中输入成员专属密码。"
    Write-Host "不要将密码写入脚本或命令行参数。"

    & staticrypt $SourceHtml `
        -d $TempDir `
        --config false `
        --remember false

    if ($LASTEXITCODE -ne 0) {
        throw "StatiCrypt 加密失败。"
    }

    # 8. 获取加密结果
    $EncryptedFiles = @(
        Get-ChildItem -LiteralPath $TempDir -Filter "*.html" -File
    )

    if ($EncryptedFiles.Count -ne 1) {
        throw "加密输出异常：预期得到一个 HTML 文件，实际得到 $($EncryptedFiles.Count) 个。"
    }

    $Encrypted = $EncryptedFiles[0]

    if ($Encrypted.Length -eq 0) {
        throw "加密输出文件为空。"
    }

    # 9. 防止覆盖已有发布文件
    if (Test-Path -LiteralPath $OutputFile) {
        throw "目标文件已存在，已停止操作。"
    }

    Copy-Item -LiteralPath $Encrypted.FullName -Destination $OutputFile

    if ((Get-Item -LiteralPath $OutputFile).Length -eq 0) {
        throw "复制后的加密文件为空。"
    }

    # 10. 仅暂存本次加密文件
    git -C $RepoPath add -- "access/$Token.html"

    if ($LASTEXITCODE -ne 0) {
        throw "Git 暂存失败。"
    }

    # 11. 显示发布预览
    Write-Host "`n=== 发布预览 ===" -ForegroundColor Cyan
    Write-Host "文件：access/$Token.html"
    Write-Host "大小：$((Get-Item $OutputFile).Length) bytes"
    Write-Host "访问地址："
    Write-Host "https://myouyim.github.io/access/$Token.html"

    Write-Host "`n=== 本次暂存文件 ===" -ForegroundColor Cyan
    git -C $RepoPath diff --cached --name-only

    Write-Host "`n=== 暂存区统计 ===" -ForegroundColor Cyan
    git -C $RepoPath diff --cached --stat

    Write-Host "`n[完成] 加密文件已生成并暂存。" -ForegroundColor Green
    Write-Host "请检查暂存区，确认无误后再手动 Commit / Push。"
}
catch {
    if (Test-Path -LiteralPath $OutputFile) {
        Remove-Item -LiteralPath $OutputFile -Force
    }

    Stop-WithError $_.Exception.Message
}
finally {
    if (Test-Path -LiteralPath $TempDir) {
        Remove-Item -LiteralPath $TempDir -Recurse -Force `
            -ErrorAction SilentlyContinue
    }
}