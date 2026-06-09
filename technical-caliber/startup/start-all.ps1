param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path
$LogDir = Join-Path $ScriptDir 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$SpringProfile = if ($env:SPRING_PROFILES_ACTIVE) { $env:SPRING_PROFILES_ACTIVE } else { 'local' }
$MavenSettings = $env:MAVEN_SETTINGS
$StoreServiceUrl = if ($env:STORE_SERVICE_URL) { $env:STORE_SERVICE_URL } else { 'http://tmall-store-service:8895' }
$RunnerScript = Join-Path $LogDir '_start-all-runner.ps1'

function Test-Jdk8Home {
  param([string]$JdkHome)
  if (-not $JdkHome) { return $false }
  $java = Join-Path $JdkHome 'bin\java.exe'
  $javac = Join-Path $JdkHome 'bin\javac.exe'
  if (-not (Test-Path $java) -or -not (Test-Path $javac)) { return $false }
  $previousEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $versionText = (& $java -version 2>&1 | Out-String)
    return $versionText -match 'version "1\.8'
  } catch {
    return $false
  } finally {
    $ErrorActionPreference = $previousEap
  }
}

function Resolve-JavaHome {
  if (Test-Jdk8Home $env:JAVA_HOME) { return $env:JAVA_HOME }
  foreach ($candidateHome in @(
    'C:\Coding\Java\jdk1.8.0_202'
  )) {
    if (Test-Jdk8Home $candidateHome) { return $candidateHome }
  }
  return $null
}

function Get-MavenArgs {
  if ($MavenSettings) { return @('--settings', $MavenSettings) }
  foreach ($file in @(
    (Join-Path $HOME '.m2\settings-tmall.xml')
    (Join-Path $HOME '.m2\settings.xml')
    'C:\Coding\Java\apache-maven-3.9.15\conf\settings-tmall.xml'
    'C:\Coding\Java\apache-maven-3.9.15\conf\settings.xml'
    'C:\Coding\Java\安装包\maven\apache-maven-3.9.12\conf\settings-tmall.xml'
    'D:\maven\apache-maven-3.9.12\conf\settings-tmall.xml'
  )) {
    if (Test-Path $file) { return @('--settings', $file) }
  }
  return @()
}

function Require-Cmd {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Missing command: $Name" }
}

function Stop-Tree {
  param([int]$ProcessId)
  if ($ProcessId -gt 0) { & taskkill /PID $ProcessId /T /F | Out-Null }
}

function Stop-ByPidFile {
  param([string]$Label, [string]$PidFile)
  if (Test-Path $PidFile) {
    $pidText = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $processId = 0
    [void][int]::TryParse($pidText, [ref]$processId)
    if ($processId -gt 0) {
      Write-Host "  stopping old $Label (PID: $processId)"
      Stop-Tree $processId
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
}

function Stop-ByPattern {
  param([string]$Label, [string]$Pattern)
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match $Pattern } |
    ForEach-Object {
      Write-Host "  stopping old $Label (PID: $($_.ProcessId))"
      Stop-Tree $_.ProcessId
    }
}

function Stop-ByPort {
  param([int]$Port)
  try {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      ForEach-Object { Stop-Tree ([int]$_) }
  } catch {}
}

function Print-RecentErrors {
  param([string]$LogFile)
  if (-not (Test-Path $LogFile)) {
    Write-Host "log file missing: $LogFile"
    return
  }
  Write-Host "---- recent errors: $LogFile ----"
  $pattern = 'ERROR|Exception|BUILD FAILURE|Compilation failure|Failed to execute goal|Application run failed|startup failed|cannot find symbol|BeanCreationException|UnsatisfiedDependencyException|BindException|PortInUseException'
  $hits = Select-String -Path $LogFile -Pattern $pattern -ErrorAction SilentlyContinue | Select-Object -Last 80
  if ($hits) {
    $hits | ForEach-Object { $_.Line }
  } else {
    Get-Content $LogFile -Tail 120 -ErrorAction SilentlyContinue
  }
  Write-Host "----------------------------------"
}

function Has-SpringStartSuccess {
  param([string]$LogFile)
  if (-not (Test-Path $LogFile)) { return $false }
  return [bool](Select-String -Path $LogFile -Pattern 'Started .+ in .+ seconds|JVM running for' -Quiet -ErrorAction SilentlyContinue)
}

function Has-SpringStartError {
  param([string]$LogFile)
  if (-not (Test-Path $LogFile)) { return $false }
  return [bool](Select-String -Path $LogFile -Pattern 'BUILD FAILURE|Compilation failure|Failed to execute goal|Application run failed|startup failed|cannot find symbol|BeanCreationException|UnsatisfiedDependencyException|BindException|PortInUseException' -Quiet -ErrorAction SilentlyContinue)
}

function Wait-ForSpringBoot {
  param([string]$Name, [int]$Port)
  $pidFile = Join-Path $LogDir "$Name.pid"
  $runLog = Join-Path $LogDir "$Name.log"
  $timeout = if ($env:STARTUP_TIMEOUT) { [int]$env:STARTUP_TIMEOUT } else { 300 }
  $elapsed = 0
  $nextProgress = 0
  Write-Host "[$Name] waiting for Spring Boot startup, port=$Port, timeout=${timeout}s"
  while ($elapsed -lt $timeout) {
    $processId = 0
    if (Test-Path $pidFile) {
      $pidText = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
      [void][int]::TryParse($pidText, [ref]$processId)
    }
    if ($processId -gt 0) {
      try { Get-Process -Id $processId -ErrorAction Stop | Out-Null } catch {
        Write-Host "[$Name] process exited, startup failed."
        Print-RecentErrors $runLog
        exit 1
      }
    }
    if (Has-SpringStartError $runLog) {
      Write-Host "[$Name] startup error found in log."
      Print-RecentErrors $runLog
      exit 1
    }
    if (Has-SpringStartSuccess $runLog) {
      try {
        if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
          Write-Host "[$Name] started successfully, port $Port is listening."
          return
        }
      } catch {}
      Write-Host "[$Name] Spring Boot success log found, waiting for port $Port..."
    }
    if ($elapsed -ge $nextProgress) {
      Write-Host "[$Name] still starting... (${elapsed}s/${timeout}s)"
      if (Test-Path $runLog) {
        Get-Content $runLog -Tail 5 -ErrorAction SilentlyContinue | ForEach-Object { "[$Name] > $_" }
      }
      $nextProgress += 15
    }
    Start-Sleep -Seconds 3
    $elapsed += 3
  }
  Write-Host "[$Name] did not emit Spring Boot success log within ${timeout}s."
  Print-RecentErrors $runLog
  exit 1
}

function Show-Usage {
@'
Usage:
  .\start-all.ps1 [options] [targets...]

Options:
  --fast               Skip Maven compile and classpath refresh.
  --build              Compile Java modules before start.
  --refresh-cp         Rebuild dependency classpath.
  --install-bms-client  Install current BMS client/model before admin.
  --full               Same as --build --refresh-cp --install-bms-client

Targets:
  all                  Start all projects.
  backend | java       Start admin and bms.
  frontend | front     Start admin-front and super-admin-front.
  admin | platform-admin
                       Start admin.
  bms                  Start bms.
  admin-front          Start admin-front.
  super-admin-front | super-front | super-admin
                       Start super-admin-front.
'@ | Write-Host
}

function Write-RunnerScript {
  $runner = @"
param(
  [Parameter(Mandatory = `$true)][ValidateSet('Spring', 'Frontend')][string]`$Mode,
  [Parameter(Mandatory = `$true)][string]`$ConfigPath
)

`$ErrorActionPreference = 'Stop'
`$Config = Get-Content `$ConfigPath -Raw | ConvertFrom-Json
Set-Location `$Config.AppDir
Set-Content -Path `$Config.PidFile -Value `$PID -NoNewline -Encoding ASCII
`$transcriptStarted = `$false
try {
  Start-Transcript -Path `$Config.RunLog -Append | Out-Null
  `$transcriptStarted = `$true
} catch {}

function Run-Spring {
  `$javaExe = Join-Path `$Config.JavaHome 'bin\java.exe'
  Write-Host "[`$(`$Config.AppName)] java home: `$(`$Config.JavaHome)"
  & `$javaExe -version
  if (`$Config.BuildMode -eq 1 -or -not (Test-Path (Join-Path `$Config.AppDir 'web\target\classes'))) {
    Write-Host "[`$(`$Config.AppName)] compile source modules..."
    `$mvnArgs = @()
    if (`$Config.MavenArgs) { `$mvnArgs += @(`$Config.MavenArgs) }
    `$mvnArgs += @('-pl','web','-am','test-compile','-Dmaven.test.skip=true')
    & mvn @`$mvnArgs
  } else {
    Write-Host "[`$(`$Config.AppName)] fast mode: skip Maven compile. Use --build to compile."
  }
  if (`$Config.RefreshCp -eq 1 -or -not (Test-Path `$Config.DepsFile) -or ((Get-Item `$Config.DepsFile -ErrorAction SilentlyContinue).Length -le 0)) {
    Write-Host "[`$(`$Config.AppName)] build dependency classpath..."
    Set-Content -Path `$Config.DepsFile -Value '' -Encoding ASCII
    foreach (`$module in @('common','model','dao','biz','client','web')) {
      `$pom = Join-Path `$Config.AppDir "`$module\pom.xml"
      if (Test-Path `$pom) {
        `$moduleTarget = Join-Path `$Config.AppDir "`$module\target"
        New-Item -ItemType Directory -Force -Path `$moduleTarget | Out-Null
        `$moduleCp = Join-Path `$moduleTarget "`$(`$Config.AppName).classpath"
        `$cpArgs = @()
        if (`$Config.MavenArgs) { `$cpArgs += @(`$Config.MavenArgs) }
        `$cpArgs += @('-q','-f',`$pom,'dependency:build-classpath',"-Dmdep.outputFile=`$moduleCp")
        & mvn @`$cpArgs
        if (Test-Path `$moduleCp) {
          `$deps = Get-Content `$moduleCp -Raw -ErrorAction SilentlyContinue
          if (`$deps) {
            `$parts = `$deps -split [IO.Path]::PathSeparator
            if (`$Config.AppName -eq 'bms') { `$parts = `$parts | Where-Object { `$_ -notmatch 'supplychain-bms-service' } }
            `$parts | Where-Object { `$_ -and `$_.Trim() } | Add-Content `$Config.DepsFile
            Add-Content `$Config.DepsFile ''
          }
        }
      }
    }
  } else {
    Write-Host "[`$(`$Config.AppName)] fast mode: reuse dependency classpath `$(`$Config.DepsFile). Use --refresh-cp to rebuild."
  }
  `$localCp = (Get-ChildItem . -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object { `$_.FullName -match '\\target\\classes$' } | Sort-Object FullName | ForEach-Object { `$_.FullName }) -join [IO.Path]::PathSeparator
  if (`$localCp) { `$localCp += [IO.Path]::PathSeparator }
  `$dependencyCp = (Get-Content `$Config.DepsFile -ErrorAction SilentlyContinue | Where-Object { `$_ -and `$_.Trim() } | Sort-Object -Unique) -join [IO.Path]::PathSeparator
  Write-Host "[`$(`$Config.AppName)] run main class: `$(`$Config.MainClass)"
  `$javaArgs = @('-Xms512m', '-Xmx1024m', '-Dfile.encoding=UTF-8')
  if (`$Config.JvmArgs) { `$javaArgs += @(`$Config.JvmArgs) }
  `$javaArgs += @('-cp', "`$localCp`$dependencyCp", `$Config.MainClass, "--spring.profiles.active=`$(`$Config.ActiveProfile)")
  & `$javaExe @`$javaArgs
}

function Run-Frontend {
  `$npmExe = 'npm'
  `$npmArgs = @()
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    if (`$Config.LocalNpmCli -and (Test-Path `$Config.LocalNpmCli)) {
      `$npmExe = 'node'
      `$npmArgs = @(`$Config.LocalNpmCli)
    } else {
      throw 'npm not found'
    }
  }
  Write-Host "[`$(`$Config.AppName)] node: " + (& node -v)
  Write-Host "[`$(`$Config.AppName)] npm: " + (& `$npmExe @`$npmArgs -v)
  if (-not (Test-Path node_modules) -and `$Config.SkipNpmInstall -ne '1') {
    Write-Host "[`$(`$Config.AppName)] node_modules missing, running npm install..."
    & `$npmExe @`$npmArgs install
  }
  `$nodeMajor = [int](& node -p 'Number(process.versions.node.split(".")[0])')
  if (`$nodeMajor -ge 17) { `$env:NODE_OPTIONS = (($env:NODE_OPTIONS, '--openssl-legacy-provider') | Where-Object { `$_ }) -join ' ' }
  `$env:npm_config_port = [string]`$Config.Port
  `$env:port = [string]`$Config.Port
  Write-Host "[`$(`$Config.AppName)] run: npm run dev -- --port `$(`$Config.Port)"
  & `$npmExe @`$npmArgs run dev -- --port `[string]`$Config.Port
}

try {
  if (`$Mode -eq 'Spring') { Run-Spring } else { Run-Frontend }
} finally {
  if (`$transcriptStarted) {
    try { Stop-Transcript | Out-Null } catch {}
  }
}
"@
  Set-Content -Path $RunnerScript -Value $runner -Encoding UTF8
}

function Start-Detached {
  param(
    [string]$Name,
    [string]$ConfigPath,
    [string]$RunLog,
    [string]$PidFile
  )
  Set-Content $RunLog '' -Encoding ASCII
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  $cmd = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $RunnerScript, '-Mode', (Get-Content $ConfigPath -Raw | ConvertFrom-Json | Select-Object -ExpandProperty Mode), '-ConfigPath', $ConfigPath)
  Start-Process -FilePath powershell.exe -WindowStyle Hidden -ArgumentList $cmd | Out-Null
}

function New-Config {
  param([hashtable]$Data)
  $Data | ConvertTo-Json -Depth 10 | Set-Content -Path $Data.ConfigPath -Encoding UTF8
}

$WantAdmin = $false
$WantBms = $false
$WantAdminFront = $false
$WantSuperAdminFront = $false
$BuildMode = 1
$RefreshCp = 1
$InstallBmsClient = 0

if ($RemainingArgs.Count -eq 0) {
  $WantAdmin = $WantBms = $WantAdminFront = $WantSuperAdminFront = $true
} else {
  foreach ($rawArg in $RemainingArgs) {
    switch ($rawArg) {
      '--fast' { $BuildMode = 0; $RefreshCp = 0 }
      '--build' { $BuildMode = 1 }
      '--refresh-cp' { $RefreshCp = 1 }
      '--install-bms-client' { $InstallBmsClient = 1 }
      '--full' { $BuildMode = 1; $RefreshCp = 1; $InstallBmsClient = 1 }
      '-h' { Show-Usage; exit 0 }
      '--help' { Show-Usage; exit 0 }
      'help' { Show-Usage; exit 0 }
      'all' { $WantAdmin = $WantBms = $WantAdminFront = $WantSuperAdminFront = $true }
      'backend' { $WantAdmin = $WantBms = $true }
      'java' { $WantAdmin = $WantBms = $true }
      'frontend' { $WantAdminFront = $WantSuperAdminFront = $true }
      'front' { $WantAdminFront = $WantSuperAdminFront = $true }
      'admin' { $WantAdmin = $true }
      'platform-admin' { $WantAdmin = $true }
      'bms' { $WantBms = $true }
      'admin-front' { $WantAdminFront = $true }
      'super-admin-front' { $WantSuperAdminFront = $true }
      'super-front' { $WantSuperAdminFront = $true }
      'super-admin' { $WantSuperAdminFront = $true }
      default { throw "Unknown target: $rawArg" }
    }
  }
}

$JavaHome = Resolve-JavaHome
if (-not $JavaHome) { throw 'JDK 8 not found.' }
$env:JAVA_HOME = $JavaHome
$env:Path = (Join-Path $JavaHome 'bin') + ';' + $env:Path
Require-Cmd java
Require-Cmd mvn
Require-Cmd node
Require-Cmd npm
$MavenArgs = Get-MavenArgs
$AdminDir = if (Test-Path (Join-Path $ProjectRoot 'backend-gateway-supplychain-shop\start.bat')) { 'backend-gateway-supplychain-shop' } elseif (Test-Path (Join-Path $ProjectRoot 'platform-admin\start.bat')) { 'platform-admin' } else { throw 'admin project not found' }
$AdminPort = if ($env:ADMIN_PORT) { [int]$env:ADMIN_PORT } else { 8896 }
$AdminMainClass = 'com.szt.supplychain.platform.admin.web.PlatformAdminModuleStarter'
$AdminProcessPattern = 'supplychain-shop-admin'
$AdminJavaOpts = @()
if ($AdminDir -eq 'backend-gateway-supplychain-shop') {
  $AdminJavaOpts = @(
    '-Ddisconf.env=rd'
    '-Ddisconf.version=1_0_0'
    '-Ddisconf.conf_server_host=http://tmall-public-disconf-web-1:8080/'
    '-Ddisconf.app=TMALL_PLATFORM_ADMIN'
    '-Ddisconf.enable.remote.conf=false'
    '-Denv=rd'
    '-Dversion=1_0_0'
    '-Dconf_server_host=http://tmall-public-disconf-web-1:8080/'
    '-Dapp=TMALL_PLATFORM_ADMIN'
    '-Denable.remote.conf=false'
    "-Dspring.config.additional-location=file:$ProjectRoot\$AdminDir\disconf\download\tmall_platform_admin\disconfBootstrap.properties"
    '-Dspring.autoconfigure.exclude=com.szt.framework.elastic_job.ElasticJobAutoConfiguration'
    '-Ddisconf.bootstrap.eagerLoad.enabled=false'
    '-Ddisconf.user_define_download_dir=disconf/download/tmall_platform_admin'
    '-Ddisconf.zk=zk-host:2181'
    '-Deureka.client.enabled=false'
    '-Dofp.sale.url=http://127.0.0.1:8080'
    '-Dofp.purchase.url=127.0.0.1:8080'
    '-Dofp.basedata.url=http://localhost:10001'
    '-Decp.console.url=http://localhost:10001'
    '-Decp-console-url=http://localhost:10001'
    '-Dois.platform.url=http://localhost:8087'
    "-Dtmall-store-service.ribbon.listOfServers=$StoreServiceUrl"
    '-Dtmall-bms-service.ribbon.listOfServers=http://127.0.0.1:8908'
    '-Dtmall-fee.ribbon.listOfServers=http://localhost:8893'
    '-DCRM.ribbon.listOfServers=http://10.42.137.90:8901'
    '-DTMALL-BASIC.ribbon.listOfServers=http://10.42.105.37:8894'
    '-Dlfc.downstream.url=http://10.42.235.176:8907'
    '-DWORKORDER.ribbon.listOfServers=http://10.42.211.135:8991'
    '-Dcxms-console-md=http://10.42.196.62:8080'
    '-Dcxms-console-md-url=http://10.42.196.62:8080'
    '-Dcxms-master-data-url=http://10.42.196.62:8080'
    '-Dcxms-outbound-url=http://10.42.196.62:8080'
    "-Dtmall-store-service=$StoreServiceUrl"
    '-Dtmall-bms-service=http://localhost:8908'
    '-Dtmall.bms.service.url=http://localhost:8908'
    '-Dtmall.jiyun.url=http://jiyun-api2:8901/jiyunapi/service/invoke'
    '-Dexport.asynctask=true'
    '-Dexport.asynctask.module=tmall-platform-admin-export'
  )
}

$BmsPort = if ($env:BMS_PORT) { [int]$env:BMS_PORT } else { 8908 }
$BmsMainClass = 'com.szt.supplychain.bms.web.BmsStarter'
$BmsProcessPattern = 'supplychain-bms'
$BmsJavaOpts = @(
  '-Ddisconf.env=rd'
  '-Ddisconf.version=1_0_0'
  '-Ddisconf.conf_server_host=http://public-disconf-web-1:8080/'
  '-Ddisconf.app=TMALL_BMS'
  '-Ddisconf.enable.remote.conf=false'
  '-Denv=rd'
  '-Dversion=1_0_0'
  '-Dconf_server_host=http://public-disconf-web-1:8080/'
  '-Dapp=TMALL_BMS'
  '-Denable.remote.conf=false'
  '-Ddisconf.bootstrap.eagerLoad.enabled=false'
  '-Ddisconf.user_define_download_dir=disconf/download'
  '-Dszt.framework.disconf.enabled=false'
  '-Dspring.autoconfigure.exclude=com.szt.framework.elastic_job.ElasticJobAutoConfiguration'
  '-Deureka.client.enabled=false'
  "-Dtmall-store-service.ribbon.listOfServers=$StoreServiceUrl"
)
$AdminFrontDir = if (Test-Path (Join-Path $ProjectRoot 'admin_front')) { 'admin_front' } elseif (Test-Path (Join-Path $ProjectRoot 'frontend-bop-shell')) { 'frontend-bop-shell' } else { $null }
$SuperAdminFrontDir = if (Test-Path (Join-Path $ProjectRoot 'super_admin_front')) { 'super_admin_front' } elseif (Test-Path (Join-Path $ProjectRoot 'frontend-bop-core')) { 'frontend-bop-core' } else { $null }
$AdminFrontPort = if ($env:ADMIN_FRONT_PORT) { [int]$env:ADMIN_FRONT_PORT } else { 9528 }
$SuperAdminFrontPort = if ($env:SUPER_ADMIN_FRONT_PORT) { [int]$env:SUPER_ADMIN_FRONT_PORT } else { 9529 }
if ($WantAdminFront -and -not $AdminFrontDir) { throw 'admin-front project not found' }
if ($WantSuperAdminFront -and -not $SuperAdminFrontDir) { throw 'super-admin-front project not found' }

Write-RunnerScript

function New-ServiceConfig {
  param([hashtable]$Data)
  if (-not $Data.ContainsKey('MavenArgs') -or -not $Data.MavenArgs) {
    $Data.MavenArgs = @()
  }
  if (-not $Data.ContainsKey('JvmArgs') -or -not $Data.JvmArgs) {
    $Data.JvmArgs = @()
  }
  $Data | ConvertTo-Json -Depth 10 | Set-Content -Path $Data.ConfigPath -Encoding UTF8
}

function Get-ModeString {
  param([bool]$IsFrontend)
  if ($IsFrontend) { 'Frontend' } else { 'Spring' }
}

function Start-Service {
  param(
    [string]$Name,
    [string]$Mode,
    [string]$Dir,
    [string]$MainClass,
    [int]$Port,
    [string[]]$JvmArgs,
    [string]$DepsFile,
    [string]$AppName,
    [bool]$SkipNpmInstall,
    [string]$LocalNpmCli
  )

  $runLog = Join-Path $LogDir "$Name.log"
  $pidFile = Join-Path $LogDir "$Name.pid"
  $configPath = Join-Path $LogDir "$Name.config.json"
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Set-Content $runLog '' -Encoding ASCII
  New-ServiceConfig @{
    ConfigPath = $configPath
    Mode = $Mode
    AppName = $AppName
    AppDir = $Dir
    MainClass = $MainClass
    Port = $Port
    JvmArgs = $JvmArgs
    DepsFile = $DepsFile
    JavaHome = $JavaHome
    ActiveProfile = $SpringProfile
    MavenArgs = $MavenArgs
    BuildMode = $BuildMode
    RefreshCp = $RefreshCp
    StoreServiceUrl = $StoreServiceUrl
    LocalNpmCli = $LocalNpmCli
    SkipNpmInstall = $(if ($SkipNpmInstall) { '1' } else { '0' })
    PidFile = $pidFile
    RunLog = $runLog
  }
  Start-Process -FilePath powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $RunnerScript, '-ConfigPath', $configPath) | Out-Null
}

Write-Host '=========================================='
Write-Host ' transportmall - start admin, bms and frontends'
Write-Host '=========================================='
Write-Host " project root: $ProjectRoot"
Write-Host " admin dir: $AdminDir"
Write-Host " admin-front dir: $AdminFrontDir"
Write-Host " super-admin-front dir: $SuperAdminFrontDir"
Write-Host " targets: admin=$WantAdmin bms=$WantBms admin-front=$WantAdminFront super-admin-front=$WantSuperAdminFront"
Write-Host " mode: build=$BuildMode refresh-cp=$RefreshCp install-bms-client=$InstallBmsClient"
Write-Host " spring profile: $SpringProfile"
Write-Host " java home: $JavaHome"
Write-Host (" maven settings: " + ($(if ($MavenSettings) { $MavenSettings } else { 'default' })))

Write-Host ''
Write-Host '[0/4] Stop old processes...'
if ($WantAdmin) {
  Stop-ByPidFile 'admin' (Join-Path $LogDir 'admin.pid')
  Stop-ByPattern 'admin' $AdminProcessPattern
  Stop-ByPort $AdminPort
}
if ($WantBms) {
  Stop-ByPidFile 'bms' (Join-Path $LogDir 'bms.pid')
  Stop-ByPattern 'bms' $BmsProcessPattern
  Stop-ByPort $BmsPort
}
if ($WantAdminFront) {
  Stop-ByPidFile 'admin-front' (Join-Path $LogDir 'admin-front.pid')
  Stop-ByPattern 'admin-front' 'vue-cli-service serve|vite'
  Stop-ByPort $AdminFrontPort
}
if ($WantSuperAdminFront) {
  Stop-ByPidFile 'super-admin-front' (Join-Path $LogDir 'super-admin-front.pid')
  Stop-ByPattern 'super-admin-front' 'vue-cli-service serve|vite'
  Stop-ByPort $SuperAdminFrontPort
}

Write-Host ''
Write-Host '[1/4] Install current BMS client/model to local Maven repository...'
if ($WantAdmin -and ($InstallBmsClient -eq 1 -or $BuildMode -eq 1)) {
  $installArgs = @('-f', (Join-Path $ProjectRoot 'backend-bms\pom.xml'), '-pl', 'client', '-am', 'install', '-DskipTests') + @($MavenArgs)
  & mvn @installArgs
} elseif ($WantAdmin) {
  Write-Host 'fast mode: skip bms client/model install.'
} else {
  Write-Host 'skip: admin not selected.'
}

Write-Host ''
Write-Host '[2/4] Start Java services from source...'
if ($WantAdmin) {
  Start-Service -Name 'admin' -Mode 'Spring' -Dir (Join-Path $ProjectRoot $AdminDir) -MainClass $AdminMainClass -Port $AdminPort -JvmArgs $AdminJavaOpts -DepsFile (Join-Path $ProjectRoot "$AdminDir\web\target\admin.deps") -AppName 'platform-admin' -SkipNpmInstall:$false -LocalNpmCli ''
}
if ($WantBms) {
  Start-Service -Name 'bms' -Mode 'Spring' -Dir (Join-Path $ProjectRoot 'backend-bms') -MainClass $BmsMainClass -Port $BmsPort -JvmArgs $BmsJavaOpts -DepsFile (Join-Path $ProjectRoot 'backend-bms\web\target\bms.deps') -AppName 'bms' -SkipNpmInstall:$false -LocalNpmCli ''
}
if (-not $WantAdmin -and -not $WantBms) {
  Write-Host 'skip: no Java services selected.'
}

Write-Host ''
Write-Host '[3/4] Check Java service startup status...'
if ($WantAdmin) { Wait-ForSpringBoot 'admin' $AdminPort }
if ($WantBms) { Wait-ForSpringBoot 'bms' $BmsPort }
if (-not $WantAdmin -and -not $WantBms) { Write-Host 'skip: no Java services selected.' }

Write-Host ''
Write-Host '[4/4] Start frontend dev servers...'
if ($WantAdminFront) {
  Start-Service -Name 'admin-front' -Mode 'Frontend' -Dir (Join-Path $ProjectRoot $AdminFrontDir) -MainClass '' -Port $AdminFrontPort -JvmArgs @() -DepsFile '' -AppName 'admin-front' -SkipNpmInstall:($env:SKIP_NPM_INSTALL -eq '1') -LocalNpmCli (Join-Path $ScriptDir 'tools\npm-6.14.18\bin\npm-cli.js')
}
if ($WantSuperAdminFront) {
  Start-Service -Name 'super-admin-front' -Mode 'Frontend' -Dir (Join-Path $ProjectRoot $SuperAdminFrontDir) -MainClass '' -Port $SuperAdminFrontPort -JvmArgs @() -DepsFile '' -AppName 'super-admin-front' -SkipNpmInstall:($env:SKIP_NPM_INSTALL -eq '1') -LocalNpmCli (Join-Path $ScriptDir 'tools\npm-6.14.18\bin\npm-cli.js')
}
if (-not $WantAdminFront -and -not $WantSuperAdminFront) { Write-Host 'skip: no frontend projects selected.' }

Write-Host ''
Write-Host '=========================================='
Write-Host ' Services started in background'
Write-Host '=========================================='
if ($WantAdmin) { Write-Host "  - admin:            http://localhost:$AdminPort" }
if ($WantBms) { Write-Host "  - bms:              http://localhost:$BmsPort" }
if ($WantAdminFront) { Write-Host "  - admin-front:      http://localhost:$AdminFrontPort" }
if ($WantSuperAdminFront) { Write-Host "  - super-admin:      http://localhost:$SuperAdminFrontPort" }
Write-Host ''
Write-Host 'Logs:'
if ($WantAdmin) { Write-Host "  - admin:            $(Join-Path $LogDir 'admin.log')" }
if ($WantBms) { Write-Host "  - bms:              $(Join-Path $LogDir 'bms.log')" }
if ($WantAdminFront) { Write-Host "  - admin-front:      $(Join-Path $LogDir 'admin-front.log')" }
if ($WantSuperAdminFront) { Write-Host "  - super-admin:      $(Join-Path $LogDir 'super-admin-front.log')" }
Write-Host ''
Write-Host 'Stop command:'
Write-Host "  Get-ChildItem '$LogDir\*.pid' | ForEach-Object { taskkill /PID (Get-Content `$_) /T /F }"
