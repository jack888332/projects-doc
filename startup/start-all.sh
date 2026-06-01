#!/usr/bin/env bash
# transportmall - start gateway, admin and bms in background.
# This is the macOS/Linux companion of each project's start.bat.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
SPRING_PROFILE="${SPRING_PROFILES_ACTIVE:-dev}"
MAVEN_SETTINGS="${MAVEN_SETTINGS:-}"
STORE_SERVICE_URL="${STORE_SERVICE_URL:-http://tmall-store-service:8895}"
BUILD_MODE=0
REFRESH_CP=0
INSTALL_BMS_CLIENT=0

for extra_path in \
  "/usr/local/bin" \
  "/opt/homebrew/bin" \
  "$HOME/software/apache-maven-3.3.9-wms/bin" \
  "$HOME/software/apache-maven-3.8.8/bin" \
  "$HOME/software/apache-maven-3.9.6/bin"; do
  if [ -d "$extra_path" ]; then
    export PATH="$extra_path:$PATH"
  fi
done

mkdir -p "$LOG_DIR"
cd "$PROJECT_ROOT"

is_jdk8() {
  local home="$1"
  [ -x "$home/bin/java" ] && [ -x "$home/bin/javac" ] && "$home/bin/java" -version 2>&1 | grep -q 'version "1\.8'
}

if [ -z "${JAVA_HOME:-}" ] || ! is_jdk8 "$JAVA_HOME"; then
  for jdk_home in \
    "$HOME/Library/Java/JavaVirtualMachines/corretto-1.8.0_322/Contents/Home" \
    "/Library/Java/JavaVirtualMachines/jdk1.8.0_221.jdk/Contents/Home" \
    "/Library/Java/JavaVirtualMachines/jdk1.8.0_202.jdk/Contents/Home"; do
    if is_jdk8 "$jdk_home"; then
      export JAVA_HOME="$jdk_home"
      export PATH="$JAVA_HOME/bin:$PATH"
      break
    fi
  done
fi

if [ -z "${JAVA_HOME:-}" ] || ! is_jdk8 "$JAVA_HOME"; then
  echo "未找到可用 JDK8。当前项目依赖老版本 Lombok，需要使用 JDK8 编译。"
  echo "请安装 JDK8，或手动设置 JAVA_HOME 后重试。"
  exit 1
fi
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

if [ -z "$MAVEN_SETTINGS" ]; then
  for settings_file in \
    "$HOME/.m2/settings-tmall.xml" \
    "$HOME/.m2/settings.xml" \
    "/usr/local/maven/conf/settings-tmall.xml" \
    "/opt/maven/conf/settings-tmall.xml"; do
    if [ -f "$settings_file" ]; then
      MAVEN_SETTINGS="--settings $settings_file"
      break
    fi
  done
fi

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "缺少命令: ${cmd}，请先安装后再执行。"
    exit 1
  fi
}

kill_by_pattern() {
  local label="$1"
  local pattern="$2"
  local pids

  pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "  停止旧进程: $label (PID: $(echo "$pids" | tr '\n' ' '))"
    kill $pids 2>/dev/null || true
    sleep 2
    pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      echo "  强制停止旧进程: $label (PID: $(echo "$pids" | tr '\n' ' '))"
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

kill_by_pid_file() {
  local label="$1"
  local pid_file="$2"
  local pid

  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "  停止旧进程: $label (PID: $pid)"
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

kill_by_port() {
  local port="$1"
  local pids

  pids="$(lsof -ti ":$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "  端口 $port 被占用，停止 PID: $(echo "$pids" | tr '\n' ' ')"
    kill $pids 2>/dev/null || true
    sleep 2
    pids="$(lsof -ti ":$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

print_recent_errors() {
  local log_file="$1"
  if [ -f "$log_file" ]; then
    echo "---- 最近错误日志: $log_file ----"
    grep -n -E "ERROR|Exception|BUILD FAILURE|Compilation failure|Failed to execute goal|Application run failed|启动失败|找不到符号|cannot find symbol" "$log_file" | tail -n 80 || tail -n 120 "$log_file"
    echo "----------------------------------"
  else
    echo "日志文件不存在: $log_file"
  fi
}

has_spring_start_success() {
  local log_file="$1"
  [ -f "$log_file" ] && grep -q -E "Started .+ in .+ seconds|JVM running for" "$log_file"
}

has_spring_start_error() {
  local log_file="$1"
  [ -f "$log_file" ] && grep -q -E "BUILD FAILURE|Compilation failure|Failed to execute goal|Application run failed|启动失败|找不到符号|cannot find symbol|BeanCreationException|UnsatisfiedDependencyException|BindException|PortInUseException" "$log_file"
}

extract_mysql_endpoint() {
  local jdbc_url="$1"

  python3 - "$jdbc_url" <<'PY'
import re
import sys

url = sys.argv[1] if len(sys.argv) > 1 else ""
match = re.search(r"jdbc:mysql://([^/:?]+)(?::([0-9]+))?/([^?]+)", url)
if not match:
    sys.exit(1)
host = match.group(1)
port = match.group(2) or "3306"
database = match.group(3)
print(f"{host} {port} {database}")
PY
}

check_tcp_endpoint() {
  local host="$1"
  local port="$2"

  if command -v nc >/dev/null 2>&1; then
    if nc -G 3 -z "$host" "$port" >/dev/null 2>&1 || nc -w 3 -z "$host" "$port" >/dev/null 2>&1; then
      echo "  TCP 检测: $host:$port 可连接"
    else
      echo "  TCP 检测: $host:$port 连接失败/超时"
    fi
  else
    echo "  TCP 检测: 未安装 nc，跳过 host:port 连通性检测"
  fi
}

print_datasource_diagnostic() {
  local label="$1"
  local file="$2"
  local url username driver password endpoint host port database

  echo "---- ${label} 数据库连接诊断 ----"
  echo "  配置文件: $file"
  if [ ! -f "$file" ]; then
    echo "  配置文件不存在，可能 disconf 还没有下载成功。"
    echo "----------------------------------"
    return 0
  fi

  url="$(read_prop "$file" url)"
  username="$(read_prop "$file" username)"
  username="${username:-$(read_prop "$file" user)}"
  driver="$(read_prop "$file" driver)"
  password="$(read_prop "$file" password)"

  echo "  driver: ${driver:-<empty>}"
  echo "  url: ${url:-<empty>}"
  echo "  username: ${username:-<empty>}"
  if [ -n "$password" ]; then
    echo "  password: ******"
  else
    echo "  password: <empty>"
  fi

  if [ -n "$url" ] && endpoint="$(extract_mysql_endpoint "$url" 2>/dev/null)"; then
    host="$(echo "$endpoint" | awk '{print $1}')"
    port="$(echo "$endpoint" | awk '{print $2}')"
    database="$(echo "$endpoint" | awk '{print $3}')"
    echo "  解析结果: host=$host port=$port database=$database"
    check_tcp_endpoint "$host" "$port"
  else
    echo "  解析结果: 不是标准 jdbc:mysql://host:port/db URL，无法检测 TCP。"
  fi
  echo "----------------------------------"
}

print_service_diagnostics() {
  local name="$1"

  case "$name" in
    gateway )
      print_datasource_diagnostic "gateway ds0" "$PROJECT_ROOT/gateway/disconf/download/tmall_gateway/DS_ds0_conf.properties"
      ;;
  esac
}

wait_for_spring_boot() {
  local name="$1"
  local port="$2"
  local pid_file="$LOG_DIR/$name.pid"
  local run_log="$LOG_DIR/$name.log"
  local timeout="${STARTUP_TIMEOUT:-300}"
  local elapsed=0
  local next_progress=0
  local pid=""

  echo "[$name] waiting for Spring Boot startup, port=$port, timeout=${timeout}s"
  while [ "$elapsed" -lt "$timeout" ]; do
    if [ -f "$pid_file" ]; then
      pid="$(cat "$pid_file" 2>/dev/null || true)"
    fi

    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      echo "[$name] process exited, startup failed."
      print_service_diagnostics "$name"
      print_recent_errors "$run_log"
      exit 1
    fi

    if has_spring_start_error "$run_log"; then
      echo "[$name] startup error found in log."
      print_service_diagnostics "$name"
      print_recent_errors "$run_log"
      exit 1
    fi

    if has_spring_start_success "$run_log"; then
      if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "[$name] started successfully, port $port is listening."
        return 0
      else
        echo "[$name] Spring Boot success log found, waiting for port $port..."
      fi
    fi

    if [ "$elapsed" -ge "$next_progress" ]; then
      echo "[$name] still starting... (${elapsed}s/${timeout}s)"
      if [ -f "$run_log" ]; then
        tail -n 5 "$run_log" | sed "s/^/[$name] > /"
      fi
      next_progress=$((next_progress + 15))
    fi

    sleep 3
    elapsed=$((elapsed + 3))
  done

  echo "[$name] did not emit Spring Boot success log within ${timeout}s."
  print_service_diagnostics "$name"
  print_recent_errors "$run_log"
  exit 1
}

join_args() {
  local joined=""
  local arg

  for arg in "$@"; do
    if [ -z "$joined" ]; then
      joined="$arg"
    else
      joined="$joined $arg"
    fi
  done
  echo "$joined"
}

read_prop() {
  local file="$1"
  local key="$2"

  if [ -f "$file" ]; then
    awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$file"
  fi
}

start_spring_boot() {
  local name="$1"
  local dir="$2"
  local main_class="$3"
  local active_profile="$4"
  shift 4
  local run_log="$LOG_DIR/$name.log"
  local pid_file="$LOG_DIR/$name.pid"
  local deps_file="$dir/web/target/$name.deps"
  local jvm_args

  jvm_args="$(join_args "$@")"
  rm -f "$pid_file"
  : > "$run_log"

  echo "[$name] 源码方式后台启动中，日志: $run_log"
  APP_NAME="$name" \
  APP_DIR="$dir" \
  MAIN_CLASS="$main_class" \
  ACTIVE_PROFILE="$active_profile" \
  DEPS_FILE="$deps_file" \
  BUILD_MODE="$BUILD_MODE" \
  REFRESH_CP="$REFRESH_CP" \
  JVM_ARGS="$jvm_args" \
  MAVEN_SETTINGS_ARGS="$MAVEN_SETTINGS" \
  RUN_LOG="$run_log" \
  PID_FILE="$pid_file" \
  START_COMMAND='
      cd "$APP_DIR"
      set -e
      echo "[$APP_NAME] java home: $JAVA_HOME"
      "$JAVA_HOME/bin/java" -version
      if [ "$BUILD_MODE" = "1" ] || [ ! -d "web/target/classes" ]; then
        echo "[$APP_NAME] compile source modules..."
        mvn -pl web -am test-compile -Dmaven.test.skip=true $MAVEN_SETTINGS_ARGS
      else
        echo "[$APP_NAME] fast mode: skip Maven compile. Use --build to compile."
      fi

      if [ "$REFRESH_CP" = "1" ] || [ ! -s "$DEPS_FILE" ]; then
        echo "[$APP_NAME] build dependency classpath..."
        : > "$DEPS_FILE"
        for module in common model dao biz client web; do
          if [ -f "$module/pom.xml" ]; then
            module_cp="$PWD/$module/target/$APP_NAME.classpath"
            mkdir -p "$PWD/$module/target"
            mvn -q -f "$module/pom.xml" dependency:build-classpath -Dmdep.outputFile="$module_cp" $MAVEN_SETTINGS_ARGS
            if [ -f "$module_cp" ]; then
              if [ "$APP_NAME" = "bms" ]; then
                tr ":" "\n" < "$module_cp" \
                  | grep -v "/com/szt/supplychain-bms-service" \
                  | grep -v "/org/apache/zookeeper/zookeeper/3.3.6/" \
                  >> "$DEPS_FILE"
              else
                tr ":" "\n" < "$module_cp" >> "$DEPS_FILE"
              fi
              echo >> "$DEPS_FILE"
            fi
          fi
        done
      else
        echo "[$APP_NAME] fast mode: reuse dependency classpath $DEPS_FILE. Use --refresh-cp to rebuild."
      fi

      local_module_cp="$(find . -maxdepth 3 -type d -path "*/target/classes" | sort | paste -sd ":" -):"
      dependency_cp="$(sort -u "$DEPS_FILE" | paste -sd ":" -)"

      echo "[$APP_NAME] run main class: $MAIN_CLASS"
      exec "$JAVA_HOME/bin/java" -Xms512m -Xmx1024m -Dfile.encoding=UTF-8 $JVM_ARGS \
        -cp "${local_module_cp}${dependency_cp}" "$MAIN_CLASS" \
        --spring.profiles.active="$ACTIVE_PROFILE"
    ' \
  python3 - <<'PY'
import os
import sys

run_log = os.environ["RUN_LOG"]
pid_file = os.environ["PID_FILE"]
command = os.environ["START_COMMAND"]

pid = os.fork()
if pid > 0:
    sys.exit(0)

os.setsid()

pid = os.fork()
if pid > 0:
    sys.exit(0)

os.umask(0)
os.chdir("/")

with open(run_log, "wb", buffering=0) as log:
    os.dup2(log.fileno(), 1)
    os.dup2(log.fileno(), 2)

with open(os.devnull, "rb", buffering=0) as devnull:
    os.dup2(devnull.fileno(), 0)

with open(pid_file, "w") as f:
    f.write(str(os.getpid()))

os.execvp("bash", ["bash", "-c", command])
PY
}

start_frontend() {
  local name="$1"
  local dir="$2"
  local port="$3"
  local run_log="$LOG_DIR/$name.log"
  local pid_file="$LOG_DIR/$name.pid"

  echo "[$name] 前端后台启动中，端口: ${port}，日志: $run_log"
  APP_NAME="$name" \
  APP_DIR="$dir" \
  APP_PORT="$port" \
  RUN_LOG="$run_log" \
  PID_FILE="$pid_file" \
  LOCAL_NPM_CLI="$SCRIPT_DIR/tools/npm-6.14.18/bin/npm-cli.js" \
  SKIP_NPM_INSTALL="${SKIP_NPM_INSTALL:-0}" \
  START_COMMAND='
      cd "$APP_DIR"
      set -e
      echo "[$APP_NAME] node: $(node -v)"
      if npm -v >/dev/null 2>&1; then
        NPM_CMD="npm"
      else
        if [ ! -f "$LOCAL_NPM_CLI" ]; then
          echo "[$APP_NAME] 全局 npm 与当前 Node 不兼容，下载本地 npm@6.14.18..."
          mkdir -p "$(dirname "$LOCAL_NPM_CLI")"
          tmp_npm_tgz="/tmp/npm-6.14.18.tgz"
          curl -L https://registry.npmjs.org/npm/-/npm-6.14.18.tgz -o "$tmp_npm_tgz"
          tar -xzf "$tmp_npm_tgz" -C "$(dirname "$LOCAL_NPM_CLI")/.." --strip-components=1
        fi
        NPM_CMD="node $LOCAL_NPM_CLI"
      fi
      echo "[$APP_NAME] npm: $($NPM_CMD -v)"
      if [ ! -d node_modules ] && [ "$SKIP_NPM_INSTALL" != "1" ]; then
        echo "[$APP_NAME] node_modules 不存在，执行 npm install..."
        $NPM_CMD install
      fi
      node_major="$(node -p "Number(process.versions.node.split(\".\")[0])")"
      if [ "$node_major" -ge 17 ]; then
        export NODE_OPTIONS="${NODE_OPTIONS:-} --openssl-legacy-provider"
      fi
      export npm_config_port="$APP_PORT"
      export port="$APP_PORT"
      echo "[$APP_NAME] run: npm run dev -- --port $APP_PORT"
      exec $NPM_CMD run dev -- --port "$APP_PORT"
    ' \
  python3 - <<'PY'
import os
import sys

run_log = os.environ["RUN_LOG"]
pid_file = os.environ["PID_FILE"]
command = os.environ["START_COMMAND"]

pid = os.fork()
if pid > 0:
    sys.exit(0)

os.setsid()

pid = os.fork()
if pid > 0:
    sys.exit(0)

os.umask(0)
os.chdir("/")

with open(run_log, "wb", buffering=0) as log:
    os.dup2(log.fileno(), 1)
    os.dup2(log.fileno(), 2)

with open(os.devnull, "rb", buffering=0) as devnull:
    os.dup2(devnull.fileno(), 0)

with open(pid_file, "w") as f:
    f.write(str(os.getpid()))

os.execvp("bash", ["bash", "-c", command])
PY
}

require_cmd java
require_cmd mvn
require_cmd python3
require_cmd node
require_cmd npm

print_usage() {
  cat <<'EOF'
用法:
  ./start-all.sh [选项] [目标...]

选项:
  --fast              快速启动，跳过 Maven 编译和 classpath 重建。默认值
  --build             启动前编译 Java 模块
  --refresh-cp        重新生成 Java 依赖 classpath
  --install-bms-client
                      启动 platform-admin 前安装当前 bms model/client
  --full              等同于 --build --refresh-cp --install-bms-client

目标:
  all                 启动全部项目，默认值
  backend | java      启动 gateway、platform-admin 和 bms
  frontend | front    启动 admin-front 和 super-admin-front
  gateway             启动 gateway
  admin | platform-admin
                      启动 platform-admin
  bms                 启动 bms
  admin-front         启动 admin_front
  super-admin-front | super-front | super-admin
                      启动 super_admin_front

示例:
  ./start-all.sh
  ./start-all.sh gateway
  ./start-all.sh bms
  ./start-all.sh --build bms
  ./start-all.sh --full gateway platform-admin bms
  ./start-all.sh gateway platform-admin bms
  ./start-all.sh admin-front
  ./start-all.sh frontend
EOF
}

ADMIN_PORT_ENV="${ADMIN_PORT:-}"
ADMIN_DIR="${ADMIN_DIR:-admin}"
ADMIN_PORT="${ADMIN_PORT_ENV:-8686}"
ADMIN_PROCESS_PATTERN="supplychain-admin-web"
ADMIN_APP_NAME="admin"
ADMIN_MAIN_CLASS="com.szt.supplychain.admin.web.AdminWebStarter"
ADMIN_SPRING_PROFILE="${ADMIN_SPRING_PROFILE:-}"
ADMIN_JAVA_OPTS=()

if [ ! -f "$PROJECT_ROOT/$ADMIN_DIR/start.bat" ] && [ -f "$PROJECT_ROOT/platform-admin/start.bat" ]; then
  ADMIN_DIR="platform-admin"
  ADMIN_PORT="${ADMIN_PORT_ENV:-8896}"
  ADMIN_PROCESS_PATTERN="supplychain-shop-admin"
  ADMIN_APP_NAME="platform-admin"
  ADMIN_MAIN_CLASS="com.szt.supplychain.platform.admin.web.PlatformAdminModuleStarter"
  ADMIN_SPRING_PROFILE="${ADMIN_SPRING_PROFILE:-dev}"
fi

if [ -z "$ADMIN_SPRING_PROFILE" ]; then
  ADMIN_SPRING_PROFILE="$SPRING_PROFILE"
fi

ADMIN_OSS_CONF_FILE="${ADMIN_OSS_CONF_FILE:-$PROJECT_ROOT/$ADMIN_DIR/disconf/download/tmall_platform_admin/aliyun_oss_conf.properties}"
ADMIN_OSS_BOOTSTRAP_FILE="${ADMIN_OSS_BOOTSTRAP_FILE:-$PROJECT_ROOT/$ADMIN_DIR/web/disconf/download/disconfBootstrap.properties}"
ADMIN_OSS_ENDPOINT="${ALIYUN_OSS_ENDPOINT:-$(read_prop "$ADMIN_OSS_CONF_FILE" endpoint)}"
ADMIN_OSS_ACCESS_KEY_ID="${ALIYUN_OSS_ACCESS_KEY_ID:-$(read_prop "$ADMIN_OSS_CONF_FILE" accessKeyId)}"
ADMIN_OSS_ACCESS_KEY_SECRET="${ALIYUN_OSS_ACCESS_KEY_SECRET:-$(read_prop "$ADMIN_OSS_CONF_FILE" accessKeySecret)}"
ADMIN_OSS_BUCKET_NAME="${ALIYUN_OSS_BUCKET_NAME:-$(read_prop "$ADMIN_OSS_CONF_FILE" bucketName)}"
ADMIN_OSS_ENDPOINT="${ADMIN_OSS_ENDPOINT:-$(read_prop "$ADMIN_OSS_BOOTSTRAP_FILE" aliyun.oss.endpoint)}"
ADMIN_OSS_ACCESS_KEY_ID="${ADMIN_OSS_ACCESS_KEY_ID:-$(read_prop "$ADMIN_OSS_BOOTSTRAP_FILE" aliyun.oss.accessKeyId)}"
ADMIN_OSS_ACCESS_KEY_SECRET="${ADMIN_OSS_ACCESS_KEY_SECRET:-$(read_prop "$ADMIN_OSS_BOOTSTRAP_FILE" aliyun.oss.accessKeySecret)}"
ADMIN_OSS_BUCKET_NAME="${ADMIN_OSS_BUCKET_NAME:-$(read_prop "$ADMIN_OSS_BOOTSTRAP_FILE" aliyun.oss.bucketName)}"
ADMIN_OSS_ENDPOINT="${ADMIN_OSS_ENDPOINT:-oss-cn-guangzhou.aliyuncs.com}"
ADMIN_OSS_ACCESS_KEY_ID="${ADMIN_OSS_ACCESS_KEY_ID:-local-dev-access-key-id}"
ADMIN_OSS_ACCESS_KEY_SECRET="${ADMIN_OSS_ACCESS_KEY_SECRET:-local-dev-access-key-secret}"
ADMIN_OSS_BUCKET_NAME="${ADMIN_OSS_BUCKET_NAME:-sztjyshop}"

if [ ! -d "$PROJECT_ROOT/$ADMIN_DIR" ]; then
  echo "未找到 admin 项目目录: $PROJECT_ROOT/$ADMIN_DIR"
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/bms/start.bat" ]; then
  echo "未找到 bms/start.bat"
  exit 1
fi

if [ "$ADMIN_DIR" = "platform-admin" ]; then
  ADMIN_JAVA_OPTS=(
    -Ddisconf.env="${ADMIN_DISCONF_ENV:-rd}"
    -Ddisconf.version="${ADMIN_DISCONF_VERSION:-1_0_0}"
    -Ddisconf.conf_server_host="${ADMIN_DISCONF_HOST:-http://tmall-public-disconf-web-1:8080/}"
    -Ddisconf.app="${ADMIN_DISCONF_APP:-TMALL_PLATFORM_ADMIN}"
    -Ddisconf.enable.remote.conf=true
    -Denv="${ADMIN_ENV:-dev}"
    -Dserver.port="$ADMIN_PORT"
    -Dversion="${ADMIN_DISCONF_VERSION:-1_0_0}"
    -Dconf_server_host="${ADMIN_DISCONF_HOST:-http://tmall-public-disconf-web-1:8080/}"
    -Dapp="${ADMIN_DISCONF_APP:-TMALL_PLATFORM_ADMIN}"
    -Denable.remote.conf=true
    -Ddisconf.bootstrap.eagerLoad.enabled="${ADMIN_DISCONF_EAGER_LOAD:-false}"
    -Ddisconf.user_define_download_dir="${ADMIN_DISCONF_DOWNLOAD_DIR:-disconf/download/tmall_platform_admin}"
    -Ddisconf.zk="${ADMIN_DISCONF_ZK:-zk-host:2181}"
    -Dconf_server_url_retry_times="${ADMIN_DISCONF_RETRY_TIMES:-3}"
    -Dconf_server_url_retry_sleep_seconds="${ADMIN_DISCONF_RETRY_SLEEP_SECONDS:-5}"
    -Deureka.client.enabled=true
    -Deureka.client.register-with-eureka=false
    -Deureka.client.fetch-registry=true
    -Deureka.client.shouldUnregisterOnShutdown=false
    -Dtmall-bms-service.ribbon.listOfServers="http://127.0.0.1:${BMS_PORT:-8908}"
    -Dtmall-bms-service="http://127.0.0.1:${BMS_PORT:-8908}"
    -Dtmall.bms.service.url="http://127.0.0.1:${BMS_PORT:-8908}"
    -Dofp.sale.url=http://127.0.0.1:8080
    -Dofp.purchase.url=127.0.0.1:8080
    -Dofp.basedata.url=http://localhost:10001
    -Decp.console.url=http://localhost:10001
    -Decp-console-url=http://localhost:10001
    -Dois.platform.url=http://localhost:8087
    -Dtmall-store-service.ribbon.listOfServers="$STORE_SERVICE_URL"
    -Dtmall-fee.ribbon.listOfServers=http://localhost:8893
    -DCRM.ribbon.listOfServers=http://10.42.137.90:8901
    -DTMALL-BASIC.ribbon.listOfServers=http://10.42.105.37:8894
    -DWORKORDER.ribbon.listOfServers=http://10.42.211.135:8991
    -Dlfc.downstream.url=http://10.42.235.176:8907
    -Dcxms-console-md=http://10.42.196.62:8080
    -Dcxms-console-md-url=http://10.42.196.62:8080
    -Dcxms-master-data-url=http://10.42.196.62:8080
    -Dcxms-outbound-url=http://10.42.196.62:8080
    -Dtmall-store-service="$STORE_SERVICE_URL"
    -Dtmall.jiyun.url=http://jiyun-api2:8901/jiyunapi/service/invoke
    -Dexport.asynctask=true
    -Dexport.asynctask.module=tmall-platform-admin-export
    -DsaleOrderAdditionalMatterTask.maxDay="${SALE_ORDER_ADDITIONAL_MATTER_TASK_MAX_DAY:-31}"
    -DsaleOrderAdditionalMatterTask.batchSize="${SALE_ORDER_ADDITIONAL_MATTER_TASK_BATCH_SIZE:-500}"
    -DsaleOrderFeeExportTask.maxDay="${SALE_ORDER_FEE_EXPORT_TASK_MAX_DAY:-31}"
    -DsaleOrderFeeExportTask.batchSize="${SALE_ORDER_FEE_EXPORT_TASK_BATCH_SIZE:-500}"
    -DshippingWaybillExportTask.batchSize="${SHIPPING_WAYBILL_EXPORT_TASK_BATCH_SIZE:-500}"
    -DmemberPackageToTreasurerExportTask.batchSize="${MEMBER_PACKAGE_TO_TREASURER_EXPORT_TASK_BATCH_SIZE:-500}"
    -Daliyun.oss.endpoint="$ADMIN_OSS_ENDPOINT"
    -Daliyun.oss.accessKeyId="$ADMIN_OSS_ACCESS_KEY_ID"
    -Daliyun.oss.accessKeySecret="$ADMIN_OSS_ACCESS_KEY_SECRET"
    -Daliyun.oss.bucketName="$ADMIN_OSS_BUCKET_NAME"
  )

  if [ "${PLATFORM_ADMIN_DISABLE_ELASTIC_JOB:-1}" = "1" ]; then
    ADMIN_JAVA_OPTS+=(
      -DelasticJobEnabled=false
      -Dspring.autoconfigure.exclude=com.szt.framework.elastic_job.ElasticJobAutoConfiguration
    )
  fi

  if [ "${PLATFORM_ADMIN_LOCAL_OVERRIDE:-0}" = "1" ]; then
    ADMIN_JAVA_OPTS+=(
      -Deureka.client.enabled=false
      -Dofp.sale.url=http://127.0.0.1:8080
      -Dofp.purchase.url=127.0.0.1:8080
      -Dofp.basedata.url=http://localhost:10001
      -Decp.console.url=http://localhost:10001
      -Decp-console-url=http://localhost:10001
      -Dois.platform.url=http://localhost:8087
      -Dtmall-store-service.ribbon.listOfServers="$STORE_SERVICE_URL"
      -Dtmall-bms-service.ribbon.listOfServers=http://127.0.0.1:8908
      -Dtmall-fee.ribbon.listOfServers=http://localhost:8893
      -DCRM.ribbon.listOfServers=http://10.42.137.90:8901
      -DTMALL-BASIC.ribbon.listOfServers=http://10.42.105.37:8894
      -Dlfc.downstream.url=http://10.42.235.176:8907
      -DWORKORDER.ribbon.listOfServers=http://10.42.211.135:8991
      -Dcxms-console-md=http://10.42.196.62:8080
      -Dcxms-console-md-url=http://10.42.196.62:8080
      -Dcxms-master-data-url=http://10.42.196.62:8080
      -Dcxms-outbound-url=http://10.42.196.62:8080
      -Dtmall-store-service="$STORE_SERVICE_URL"
      -Dtmall-bms-service=http://localhost:8908
      -Dtmall.bms.service.url=http://localhost:8908
      -Dtmall.jiyun.url=http://jiyun-api2:8901/jiyunapi/service/invoke
      -Dexport.asynctask=true
      -Dexport.asynctask.module=tmall-platform-admin-export
    )
  fi
fi

GATEWAY_PORT="${GATEWAY_PORT:-8897}"
GATEWAY_PROCESS_PATTERN="supplychain-gateway"
GATEWAY_MAIN_CLASS="com.szt.supplychain.gateway.web.GatewayStarter"
GATEWAY_SPRING_PROFILE="${GATEWAY_SPRING_PROFILE:-$SPRING_PROFILE}"
GATEWAY_JAVA_OPTS=(
  -Ddisconf.env="${GATEWAY_DISCONF_ENV:-rd}"
  -Ddisconf.version="${GATEWAY_DISCONF_VERSION:-1_0_0}"
  -Ddisconf.conf_server_host="${GATEWAY_DISCONF_HOST:-http://tmall-public-disconf-web-1:8080/}"
  -Ddisconf.app="${GATEWAY_DISCONF_APP:-TMALL_GATEWAY}"
  -Ddisconf.enable.remote.conf=true
  -Denv="${GATEWAY_ENV:-dev}"
  -Dserver.port="$GATEWAY_PORT"
  -Dversion="${GATEWAY_DISCONF_VERSION:-1_0_0}"
  -Dconf_server_host="${GATEWAY_DISCONF_HOST:-http://tmall-public-disconf-web-1:8080/}"
  -Dapp="${GATEWAY_DISCONF_APP:-TMALL_GATEWAY}"
  -Denable.remote.conf=true
  -Ddisconf.ignore="${GATEWAY_DISCONF_IGNORE:-mongo_conf.properties,minio_conf.properties,token-config.properties,spring_bus_conf.properties,redis.conf,sharding_index_conf.properties}"
  -Dignore="${GATEWAY_DISCONF_IGNORE:-mongo_conf.properties,minio_conf.properties,token-config.properties,spring_bus_conf.properties,redis.conf,sharding_index_conf.properties}"
  -Ddisconf.bootstrap.eagerLoad.enabled="${GATEWAY_DISCONF_EAGER_LOAD:-false}"
  -Ddisconf.user_define_download_dir="${GATEWAY_DISCONF_DOWNLOAD_DIR:-disconf/download/tmall_gateway}"
  -Ddisconf.zk="${GATEWAY_DISCONF_ZK:-zk-host:2181}"
  -Dconf_server_url_retry_times="${GATEWAY_DISCONF_RETRY_TIMES:-3}"
  -Dconf_server_url_retry_sleep_seconds="${GATEWAY_DISCONF_RETRY_SLEEP_SECONDS:-5}"
  -Deureka.client.enabled=true
  -Deureka.client.register-with-eureka=false
  -Deureka.client.fetch-registry=true
  -Deureka.client.shouldUnregisterOnShutdown=false
  -Dlocal.bms.portal.proxy.enabled="${GATEWAY_LOCAL_BMS_PROXY_ENABLED:-true}"
  -Dlocal.platform.admin.url="${GATEWAY_LOCAL_PLATFORM_ADMIN_URL:-http://127.0.0.1:$ADMIN_PORT}"
)

BMS_PORT="${BMS_PORT:-8908}"
BMS_PROCESS_PATTERN="supplychain-bms"
BMS_MAIN_CLASS="com.szt.supplychain.bms.web.BmsStarter"
BMS_SPRING_PROFILE="${BMS_SPRING_PROFILE:-$SPRING_PROFILE}"
BMS_JAVA_OPTS=(
  -Ddisconf.env="${BMS_DISCONF_ENV:-rd}"
  -Ddisconf.version="${BMS_DISCONF_VERSION:-1_0_0}"
  -Ddisconf.conf_server_host="${BMS_DISCONF_HOST:-http://tmall-public-disconf-web-1:8080/}"
  -Ddisconf.app="${BMS_DISCONF_APP:-TMALL_BMS}"
  -Ddisconf.enable.remote.conf=true
  -Denv="${BMS_ENV:-dev}"
  -Dserver.port="$BMS_PORT"
  -Dversion="${BMS_DISCONF_VERSION:-1_0_0}"
  -Dconf_server_host="${BMS_DISCONF_HOST:-http://tmall-public-disconf-web-1:8080/}"
  -Dapp="${BMS_DISCONF_APP:-TMALL_BMS}"
  -Denable.remote.conf=true
  -Ddisconf.bootstrap.eagerLoad.enabled="${BMS_DISCONF_EAGER_LOAD:-false}"
  -Ddisconf.user_define_download_dir="${BMS_DISCONF_DOWNLOAD_DIR:-disconf/download}"
  -Ddisconf.zk="${BMS_DISCONF_ZK:-zk-host:2181}"
  -Dconf_server_url_retry_times="${BMS_DISCONF_RETRY_TIMES:-3}"
  -Dconf_server_url_retry_sleep_seconds="${BMS_DISCONF_RETRY_SLEEP_SECONDS:-5}"
  -DelasticJobEnabled=false
  -Dspring.autoconfigure.exclude=com.szt.framework.elastic_job.ElasticJobAutoConfiguration
  -Deureka.client.enabled=true
  -Deureka.client.register-with-eureka=false
  -Deureka.client.fetch-registry=true
  -Deureka.client.shouldUnregisterOnShutdown=false
)
ADMIN_FRONT_DIR="${ADMIN_FRONT_DIR:-admin_front}"
SUPER_ADMIN_FRONT_DIR="${SUPER_ADMIN_FRONT_DIR:-super_admin_front}"
ADMIN_FRONT_PORT="${ADMIN_FRONT_PORT:-9528}"
SUPER_ADMIN_FRONT_PORT="${SUPER_ADMIN_FRONT_PORT:-9529}"

WANT_GATEWAY=0
WANT_ADMIN=0
WANT_BMS=0
WANT_ADMIN_FRONT=0
WANT_SUPER_ADMIN_FRONT=0
TARGET_ARGS=()

select_target() {
  local target="$1"

  case "$target" in
    "" )
      ;;
    -h|--help|help )
      print_usage
      exit 0
      ;;
    all )
      WANT_GATEWAY=1
      WANT_ADMIN=1
      WANT_BMS=1
      WANT_ADMIN_FRONT=1
      WANT_SUPER_ADMIN_FRONT=1
      ;;
    backend|java )
      WANT_GATEWAY=1
      WANT_ADMIN=1
      WANT_BMS=1
      ;;
    frontend|front )
      WANT_ADMIN_FRONT=1
      WANT_SUPER_ADMIN_FRONT=1
      ;;
    gateway )
      WANT_GATEWAY=1
      ;;
    admin|platform-admin )
      WANT_ADMIN=1
      ;;
    bms )
      WANT_BMS=1
      ;;
    admin-front|admin_front )
      WANT_ADMIN_FRONT=1
      ;;
    super-admin-front|super_admin_front|super-front|super-admin )
      WANT_SUPER_ADMIN_FRONT=1
      ;;
    * )
      echo "未知启动目标: $target"
      echo ""
      print_usage
      exit 1
      ;;
  esac
}

for raw_arg in "$@"; do
  case "$raw_arg" in
    --fast )
      BUILD_MODE=0
      REFRESH_CP=0
      ;;
    --build )
      BUILD_MODE=1
      ;;
    --refresh-cp )
      REFRESH_CP=1
      ;;
    --install-bms-client )
      INSTALL_BMS_CLIENT=1
      ;;
    --full )
      BUILD_MODE=1
      REFRESH_CP=1
      INSTALL_BMS_CLIENT=1
      ;;
    * )
      TARGET_ARGS+=("$raw_arg")
      ;;
  esac
done

if [ "${#TARGET_ARGS[@]}" -eq 0 ]; then
  select_target all
else
  for raw_target in "${TARGET_ARGS[@]}"; do
    old_ifs="$IFS"
    IFS=","
    set -- $raw_target
    IFS="$old_ifs"
    for target in "$@"; do
      select_target "$target"
    done
  done
fi

if [ "$WANT_ADMIN_FRONT" = "1" ] && [ ! -d "$PROJECT_ROOT/$ADMIN_FRONT_DIR" ]; then
  echo "未找到 admin_front 项目目录: $PROJECT_ROOT/$ADMIN_FRONT_DIR"
  exit 1
fi

if [ "$WANT_SUPER_ADMIN_FRONT" = "1" ] && [ ! -d "$PROJECT_ROOT/$SUPER_ADMIN_FRONT_DIR" ]; then
  echo "未找到 super_admin_front 项目目录: $PROJECT_ROOT/$SUPER_ADMIN_FRONT_DIR"
  exit 1
fi

if [ "$WANT_GATEWAY" = "1" ] && [ ! -d "$PROJECT_ROOT/gateway" ]; then
  echo "未找到 gateway 项目目录: $PROJECT_ROOT/gateway"
  exit 1
fi

echo "=========================================="
echo " transportmall - 启动 gateway、admin、bms 和前端"
echo "=========================================="
echo " 项目根目录: $PROJECT_ROOT"
echo " 网关项目:   gateway"
echo " 管理端项目: $ADMIN_DIR"
echo " 管理端前端: $ADMIN_FRONT_DIR"
echo " 超管前端:   $SUPER_ADMIN_FRONT_DIR"
echo " 启动目标:   gateway=$WANT_GATEWAY admin=$WANT_ADMIN bms=$WANT_BMS admin-front=$WANT_ADMIN_FRONT super-admin-front=$WANT_SUPER_ADMIN_FRONT"
echo " 启动模式:   build=$BUILD_MODE refresh-cp=$REFRESH_CP install-bms-client=$INSTALL_BMS_CLIENT"
echo " Spring profile: gateway=$GATEWAY_SPRING_PROFILE admin=$ADMIN_SPRING_PROFILE bms=$BMS_SPRING_PROFILE"
echo " gateway disconf: remote=true app=${GATEWAY_DISCONF_APP:-TMALL_GATEWAY} env=${GATEWAY_DISCONF_ENV:-rd} host=${GATEWAY_DISCONF_HOST:-http://tmall-public-disconf-web-1:8080/}"
if [ "$ADMIN_DIR" = "platform-admin" ]; then
  echo " platform-admin disconf: remote=true app=${ADMIN_DISCONF_APP:-TMALL_PLATFORM_ADMIN} env=${ADMIN_DISCONF_ENV:-rd} host=${ADMIN_DISCONF_HOST:-http://tmall-public-disconf-web-1:8080/}"
  echo " platform-admin local override: ${PLATFORM_ADMIN_LOCAL_OVERRIDE:-0}"
fi
echo " bms disconf: remote=true app=${BMS_DISCONF_APP:-TMALL_BMS} env=${BMS_DISCONF_ENV:-rd} host=${BMS_DISCONF_HOST:-http://tmall-public-disconf-web-1:8080/}"
echo " eureka: fetch remote registry=true, register local backend=false"
echo " Java home: ${JAVA_HOME:-$(command -v java)}"
if [ -n "$MAVEN_SETTINGS" ]; then
  echo " Maven settings: $MAVEN_SETTINGS"
else
  echo " Maven settings: 使用 Maven 默认配置"
fi
if [ "$WANT_GATEWAY" = "1" ]; then
  print_service_diagnostics "gateway"
fi

echo ""
echo "[0/4] Stop old processes..."
if [ "$WANT_GATEWAY" = "1" ]; then
  kill_by_pid_file "gateway" "$LOG_DIR/gateway.pid"
  kill_by_pattern "gateway" "$GATEWAY_PROCESS_PATTERN"
  kill_by_port "$GATEWAY_PORT"
fi
if [ "$WANT_ADMIN" = "1" ]; then
  kill_by_pid_file "$ADMIN_APP_NAME" "$LOG_DIR/$ADMIN_APP_NAME.pid"
  kill_by_pattern "$ADMIN_APP_NAME" "$ADMIN_PROCESS_PATTERN"
  kill_by_port "$ADMIN_PORT"
fi
if [ "$WANT_BMS" = "1" ]; then
  kill_by_pid_file "bms" "$LOG_DIR/bms.pid"
  kill_by_pattern "bms" "$BMS_PROCESS_PATTERN"
  kill_by_port "$BMS_PORT"
fi
if [ "$WANT_ADMIN_FRONT" = "1" ]; then
  kill_by_pid_file "admin-front" "$LOG_DIR/admin-front.pid"
  kill_by_pattern "admin-front" "$PROJECT_ROOT/$ADMIN_FRONT_DIR.*vue-cli-service serve"
  kill_by_port "$ADMIN_FRONT_PORT"
fi
if [ "$WANT_SUPER_ADMIN_FRONT" = "1" ]; then
  kill_by_pid_file "super-admin-front" "$LOG_DIR/super-admin-front.pid"
  kill_by_pattern "super-admin-front" "$PROJECT_ROOT/$SUPER_ADMIN_FRONT_DIR.*vue-cli-service serve"
  kill_by_port "$SUPER_ADMIN_FRONT_PORT"
fi

echo ""
echo "[1/4] Install local Java module artifacts if needed..."
GATEWAY_DEPS_FILE="$PROJECT_ROOT/gateway/web/target/gateway.deps"
if [ "$WANT_GATEWAY" = "1" ] && { [ "$BUILD_MODE" = "1" ] || [ ! -s "$GATEWAY_DEPS_FILE" ] || ! grep -q "spring-webflux" "$GATEWAY_DEPS_FILE" 2>/dev/null; }; then
  echo "安装 gateway 本地模块，避免源码启动时解析不到 gateway common/model/dao/biz。"
  rm -f "$GATEWAY_DEPS_FILE"
  mvn -f "$PROJECT_ROOT/gateway/pom.xml" -pl web -am install -DskipTests $MAVEN_SETTINGS
elif [ "$WANT_GATEWAY" = "1" ]; then
  echo "快速启动：gateway classpath 已存在，跳过 gateway 本地模块 install。"
else
  echo "跳过：未启动 gateway。"
fi

if [ "$WANT_ADMIN" = "1" ] && { [ "$INSTALL_BMS_CLIENT" = "1" ] || [ "$BUILD_MODE" = "1" ]; }; then
  mvn -f "$PROJECT_ROOT/bms/pom.xml" -pl client -am install -DskipTests $MAVEN_SETTINGS
elif [ "$WANT_ADMIN" = "1" ]; then
  echo "快速启动：跳过 bms client/model install。改了 BMS model/client 后请加 --install-bms-client 或 --build。"
else
  echo "跳过：未启动 platform-admin，不需要安装 bms client/model。"
fi

echo ""
echo "[2/4] Start Java services from source..."
if [ "$WANT_GATEWAY" = "1" ]; then
  start_spring_boot "gateway" "$PROJECT_ROOT/gateway" "$GATEWAY_MAIN_CLASS" "$GATEWAY_SPRING_PROFILE" "${GATEWAY_JAVA_OPTS[@]}"
fi
if [ "$WANT_ADMIN" = "1" ]; then
  start_spring_boot "$ADMIN_APP_NAME" "$PROJECT_ROOT/$ADMIN_DIR" "$ADMIN_MAIN_CLASS" "$ADMIN_SPRING_PROFILE" "${ADMIN_JAVA_OPTS[@]}"
fi
if [ "$WANT_BMS" = "1" ]; then
  start_spring_boot "bms" "$PROJECT_ROOT/bms" "$BMS_MAIN_CLASS" "$BMS_SPRING_PROFILE" "${BMS_JAVA_OPTS[@]}"
fi
if [ "$WANT_GATEWAY" != "1" ] && [ "$WANT_ADMIN" != "1" ] && [ "$WANT_BMS" != "1" ]; then
  echo "跳过：未选择 Java 服务。"
fi

echo ""
echo "[3/4] Check Java service startup status..."
if [ "$WANT_GATEWAY" = "1" ]; then
  wait_for_spring_boot "gateway" "$GATEWAY_PORT"
fi
if [ "$WANT_ADMIN" = "1" ]; then
  wait_for_spring_boot "$ADMIN_APP_NAME" "$ADMIN_PORT"
fi
if [ "$WANT_BMS" = "1" ]; then
  wait_for_spring_boot "bms" "$BMS_PORT"
fi
if [ "$WANT_GATEWAY" != "1" ] && [ "$WANT_ADMIN" != "1" ] && [ "$WANT_BMS" != "1" ]; then
  echo "跳过：未选择 Java 服务。"
fi

echo ""
echo "[4/4] Start frontend dev servers..."
if [ "$WANT_ADMIN_FRONT" = "1" ]; then
  start_frontend "admin-front" "$PROJECT_ROOT/$ADMIN_FRONT_DIR" "$ADMIN_FRONT_PORT"
fi
if [ "$WANT_SUPER_ADMIN_FRONT" = "1" ]; then
  start_frontend "super-admin-front" "$PROJECT_ROOT/$SUPER_ADMIN_FRONT_DIR" "$SUPER_ADMIN_FRONT_PORT"
fi
if [ "$WANT_ADMIN_FRONT" != "1" ] && [ "$WANT_SUPER_ADMIN_FRONT" != "1" ]; then
  echo "跳过：未选择前端项目。"
fi

echo ""
echo "=========================================="
echo " Services started in background"
echo "=========================================="
if [ "$WANT_GATEWAY" = "1" ]; then
  echo "  - gateway:         http://localhost:$GATEWAY_PORT"
fi
if [ "$WANT_ADMIN" = "1" ]; then
  echo "  - $ADMIN_APP_NAME: http://localhost:$ADMIN_PORT"
fi
if [ "$WANT_BMS" = "1" ]; then
  echo "  - bms:             http://localhost:$BMS_PORT"
fi
if [ "$WANT_ADMIN_FRONT" = "1" ]; then
  echo "  - admin-front:     http://localhost:$ADMIN_FRONT_PORT"
fi
if [ "$WANT_SUPER_ADMIN_FRONT" = "1" ]; then
  echo "  - super-admin:     http://localhost:$SUPER_ADMIN_FRONT_PORT"
fi
echo ""
echo "Logs:"
if [ "$WANT_GATEWAY" = "1" ]; then
  echo "  - gateway:         $LOG_DIR/gateway.log"
fi
if [ "$WANT_ADMIN" = "1" ]; then
  echo "  - $ADMIN_APP_NAME: $LOG_DIR/$ADMIN_APP_NAME.log"
fi
if [ "$WANT_BMS" = "1" ]; then
  echo "  - bms:             $LOG_DIR/bms.log"
fi
if [ "$WANT_ADMIN_FRONT" = "1" ]; then
  echo "  - admin-front:     $LOG_DIR/admin-front.log"
fi
if [ "$WANT_SUPER_ADMIN_FRONT" = "1" ]; then
  echo "  - super-admin:     $LOG_DIR/super-admin-front.log"
fi
echo ""
echo "Stop command:"
echo "  kill \$(cat \"$LOG_DIR\"/*.pid)"
