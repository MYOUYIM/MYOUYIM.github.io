param(
    [Parameter(Mandatory = $true)]
    [string]$SourceHtml,

    [Parameter(Mandatory = $true)]
    [string]$RepoPath
)

$ErrorActionPreference = "Stop"

# 1. 验证输入
$SourceHtml = (Resolve-Path $SourceHtml).Path
$RepoPath = (Resolve-Path $RepoPath).Path

if (-not $SourceHtml.EndsWith(".html", [StringComparison]::OrdinalIgnoreCase)) {
    throw "只允许输入 HTML 文件"
}

if (-not (Test-Path (Join-Path $RepoPath ".git"))) {
    throw "目标目录不是 Git 仓库"
}

if (-not (Get-Command staticrypt -ErrorAction SilentlyContinue)) {
    throw "没有检测到 StatiCrypt，请先安装"
}

# 2. 检查仓库当前状态
Write-Host "`n=== Git 当前状态 ==="
git -C $RepoPath status --short

# 3. 生成随机访问文件名
$Token = [guid]::NewGuid().ToString("N")
$AccessDir = Join-Path $RepoPath "access"
$TempDir = Join-Path $env:TEMP "member-build-$Token"
$OutputFile = Join-Path $AccessDir "$Token.html"

New-Item -ItemType Directory -Force $AccessDir | Out-Null
New-Item -ItemType Directory -Force $TempDir | Out-Null

try {
    # 4. 使用 StatiCrypt 加密
    # 密码由 StatiCrypt 交互式询问，不写在脚本/命令参数中
    Write-Host "`n=== 请在 StatiCrypt 密码提示中输入成员专属密码 ==="

    & staticrypt $SourceHtml `
        -d $TempDir `
        --config false `
        --remember false

    if ($LASTEXITCODE -ne 0) {
        throw "StatiCrypt 加密失败"
    }

    # 5. 取得加密结果
    $Encrypted = Get-ChildItem $TempDir -Filter "*.html" |
        Select-Object -First 1

    if (-not $Encrypted) {
        throw "未找到加密 HTML"
    }

    # 6. 复制密文到仓库
    Copy-Item $Encrypted.FullName $OutputFile

    # 7. 基础校验
    if ((Get-Item $OutputFile).Length -eq 0) {
        throw "密文文件为空"
    }

    # 8. 仅暂存本次密文
    git -C $RepoPath add -- "access/$Token.html"

    if ($LASTEXITCODE -ne 0) {
        throw "Git 暂存失败"
    }

    # 9. 展示检查信息
    Write-Host "`n=== 发布预览 ==="
    Write-Host "文件：access/$Token.html"
    Write-Host "大小：$((Get-Item $OutputFile).Length) bytes"
    Write-Host "链接：https://myouyim.github.io/access/$Token.html"

    Write-Host "`n=== 暂存区检查 ==="
    git -C $RepoPath diff --cached --stat
    git -C $RepoPath diff --cached --name-only

    Write-Host "`n发布文件已生成并暂存。"
    Write-Host "请检查 Git 暂存区后，手动 Commit / Push。"
}
finally {
    # 清理临时加密输出
    Remove-Item $TempDir -Recurse -Force `
        -ErrorAction SilentlyContinue
}