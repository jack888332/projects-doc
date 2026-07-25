# GitLab Pages + VitePress AI 文档站搭建与接入指引

## 目标

搭建内网 GitLab Pages 文档站，用于发布 AI 生成的 Markdown、HTML、SQL 等文档，并支持主站统一检索多个项目文档。

当前推荐主入口：

```text
http://transportmall.pages.sztgitlab/aidocs/
```

示例子站：

```text
http://chaorong.lai.pages.sztgitlab/ai-docs/
```

整体流程：

```text
提交文档
  -> GitLab CI 触发 pages job
  -> Runner 使用 VitePress builder 镜像构建
  -> 生成 public/
  -> GitLab Pages 发布
  -> 用户通过 pages.sztgitlab 访问
```

## 一、GitLab 服务器启用 Pages

进入 GitLab 服务器或 GitLab 容器：

```bash
vi /etc/gitlab/gitlab.rb
```

配置：

```ruby
external_url "http://sztgitlab"

pages_external_url "http://pages.sztgitlab"
gitlab_pages['enable'] = true
gitlab_pages['inplace_chroot'] = true
```

注意：`pages_external_url` 不能带路径。

错误示例：

```ruby
pages_external_url "http://sztgitlab/pages/"
```

正确示例：

```ruby
pages_external_url "http://pages.sztgitlab"
```

如果 GitLab 是 Docker 部署，建议必须加：

```ruby
gitlab_pages['inplace_chroot'] = true
```

否则可能报：

```text
Failed to bind mount ... operation not permitted
```

执行：

```bash
gitlab-ctl reconfigure
gitlab-ctl restart
gitlab-ctl status | grep pages
```

验证：

```bash
curl 127.0.0.1:8090
```

查看日志：

```bash
gitlab-ctl tail gitlab-pages
```

## 二、办公室网络 DNS 配置

需要让办公网络能解析 GitLab 和 Pages 域名。

建议 DNS 记录：

```text
sztgitlab                  A    192.168.0.242
pages.sztgitlab            A    192.168.0.242
*.pages.sztgitlab          A    192.168.0.242
```

最关键的是：

```text
*.pages.sztgitlab -> 192.168.0.242
```

用户电脑验证：

```bash
nslookup sztgitlab
nslookup pages.sztgitlab
nslookup transportmall.pages.sztgitlab
nslookup chaorong.lai.pages.sztgitlab
```

能解析后，浏览器才能访问：

```text
http://transportmall.pages.sztgitlab/aidocs/
```

## 三、GitLab 项目启用 CI/CD

进入项目：

```text
Project -> Settings -> General -> Permissions
```

确认：

```text
Pipelines / CI-CD = Enabled
```

然后进入：

```text
Project -> Settings -> CI/CD -> Runners
```

确认项目能看到可用 Runner。

## 四、Runner 类型选择

GitLab Runner 有三类：

```text
Specific Runner
Group Runner
Shared Runner
```

推荐：

```text
个人临时项目：Specific Runner
一个业务组多个项目：Group Runner
全公司共用：Shared Runner
```

文档站更推荐使用 `Group Runner` 或 `Shared Runner`，这样多个文档项目不用重复部署 Runner。

## 五、Rancher 1.6 部署 GitLab Runner

在 Rancher 1.6 新建 Stack：

```text
gitlab-runner-pages
```

服务名：

```text
gitlab-runner
```

镜像：

```text
gitlab/gitlab-runner:v14.6.0
```

推荐 `docker-compose.yml`：

```yaml
version: '2'

services:
  gitlab-runner:
    image: gitlab/gitlab-runner:v14.6.0
    restart: always
    extra_hosts:
      - "sztgitlab:192.168.0.242"
    volumes:
      - /srv/gitlab-runner/pages-config:/etc/gitlab-runner
      - /var/run/docker.sock:/var/run/docker.sock
```

说明：

```text
/srv/gitlab-runner/pages-config:/etc/gitlab-runner
用于持久化 runner 配置

/var/run/docker.sock:/var/run/docker.sock
用于 Docker executor 创建 CI job 容器

extra_hosts
用于 runner 容器自身解析 sztgitlab
```

## 六、注册 Runner

进入 Runner 容器：

```bash
docker exec -it gitlab-runner gitlab-runner register
```

如果容器名由 Rancher 自动生成，可以先查：

```bash
docker ps | grep gitlab-runner
```

注册时填写：

```text
GitLab instance URL:
http://sztgitlab/

Registration token:
从 GitLab Runner 页面复制

Description:
page-runner-rancher

Tags:
pages

Executor:
docker

Default Docker image:
alpine:latest
```

注册完成后，GitLab 页面应该能看到 Runner。

## 七、配置 Runner extra_hosts

注册后修改宿主机配置：

```bash
vi /srv/gitlab-runner/pages-config/config.toml
```

找到对应 Runner 的：

```toml
[runners.docker]
```

增加：

```toml
extra_hosts = ["sztgitlab:192.168.0.242"]
```

完整示例：

```toml
[[runners]]
  name = "page-runner-rancher"
  url = "http://sztgitlab/"
  token = "xxxx"
  executor = "docker"

  [runners.docker]
    image = "alpine:latest"
    privileged = false
    disable_cache = false
    volumes = ["/cache"]
    shm_size = 0
    extra_hosts = ["sztgitlab:192.168.0.242"]
```

注意：

```text
extra_hosts 必须写在 [runners.docker] 下面
不要重复写 shm_size、volumes 等 key
```

否则可能报：

```text
Key 'runners.docker.shm_size' has already been defined
```

重启 Runner：

```bash
docker restart gitlab-runner
```

或在 Rancher 页面：

```text
Stack -> gitlab-runner-pages -> gitlab-runner -> Restart
```

查看日志：

```bash
docker logs -f gitlab-runner
```

正常日志：

```text
Starting multi-runner from /etc/gitlab-runner/config.toml
Running in system-mode
```

## 八、内网 Docker Registry

当前 builder 镜像：

```text
192.168.0.242:5000/docs/ai-docs-vitepress-builder:latest
```

作用：

```text
提前安装 Node、npm、VitePress、git
CI 不需要每次访问公网拉依赖
提高构建速度和稳定性
```

如果 Runner 拉镜像时报：

```text
http: server gave HTTP response to HTTPS client
```

需要在 Runner 宿主机 Docker daemon 配置 insecure registry：

```json
{
  "insecure-registries": ["192.168.0.242:5000"]
}
```

然后重启 Docker。

## 九、项目 .gitlab-ci.yml

VitePress 文档站推荐配置：

```yaml
stages:
  - deploy

pages:
  stage: deploy
  tags:
    - pages
  image: 192.168.0.242:5000/docs/ai-docs-vitepress-builder:latest
  script:
    - node scripts/build-vitepress.mjs
  artifacts:
    paths:
      - public/
  only:
    - master
```

重点：

```text
job 名必须叫 pages
artifacts 必须包含 public/
public/ 是 GitLab Pages 的发布目录
tag 要和 Runner 标签一致，例如 pages
```

## 十、最小静态文件模式

如果项目只是想直接发布根目录文件，不使用 VitePress：

```yaml
stages:
  - deploy

pages:
  stage: deploy
  tags:
    - pages
  image: alpine:latest
  script:
    - mkdir -p public
    - find . -mindepth 1 -maxdepth 1 ! -name public ! -name .git ! -name .gitlab-ci.yml -exec cp -r {} public/ \;
  artifacts:
    paths:
      - public/
  only:
    - master
```

访问时就是原文件路径：

```text
http://xxx.pages.sztgitlab/project-name/file.html
http://xxx.pages.sztgitlab/project-name/file.md
```

缺点：

```text
Markdown 原样展示，不美观
没有目录
没有统一搜索
```

## 十一、VitePress 模式

推荐用于正式文档站。

支持：

```text
首页
目录分类
搜索
Markdown 美化展示
HTML 文档展示
SQL 文档展示
多项目索引聚合
```

当前 `transportmall/aidocs` 扫描目录：

```text
product-caliber/
technical-caliber/
```

支持文件：

```text
.md       直接渲染成 VitePress 页面，支持正文搜索
.html     iframe 保真展示，同时提取文字用于首页搜索
.sql      渲染成代码页面
```

## 十二、GitLab Pages 访问规则

GitLab Pages 地址格式：

```text
http://<namespace>.pages.sztgitlab/<project>/
```

示例：

```text
http://transportmall.pages.sztgitlab/aidocs/
http://chaorong.lai.pages.sztgitlab/ai-docs/
```

具体文件示例：

```text
http://transportmall.pages.sztgitlab/aidocs/product-caliber/bms/prd/doc-prd-80fdbfd713.html
```

注意项目名路径不能省略：

```text
/aidocs/
/ai-docs/
```

## 十三、GitLab 服务器验证输出文件

CI 成功后，在 GitLab 服务器查看 Pages 文件：

```bash
find /var/opt/gitlab/gitlab-rails/shared/pages -maxdepth 6 -type f | head -80
```

查看某个项目：

```bash
find /var/opt/gitlab/gitlab-rails/shared/pages/transportmall/aidocs/public -maxdepth 5 -type f | head -80
```

验证首页：

```bash
ls -l /var/opt/gitlab/gitlab-rails/shared/pages/transportmall/aidocs/public/index.html
```

验证搜索索引：

```bash
ls -l /var/opt/gitlab/gitlab-rails/shared/pages/transportmall/aidocs/public/search-index.json
ls -l /var/opt/gitlab/gitlab-rails/shared/pages/transportmall/aidocs/public/search-index.js
```

验证某个文档：

```bash
find /var/opt/gitlab/gitlab-rails/shared/pages/transportmall/aidocs/public -name 'doc-prd-80fdbfd713.html'
```

如果目录里只有：

```text
.daemon.xxxxx
```

说明 Pages 没有发布项目文件，通常是：

```text
CI 没成功
pages job 没生成 public/
GitLab Pages 没启用成功
```

## 十四、浏览器验证

访问首页：

```text
http://transportmall.pages.sztgitlab/aidocs/
```

访问搜索索引：

```text
http://transportmall.pages.sztgitlab/aidocs/search-index.json
http://transportmall.pages.sztgitlab/aidocs/search-index.js
```

访问文档：

```text
http://transportmall.pages.sztgitlab/aidocs/product-caliber/bms/prd/doc-prd-80fdbfd713.html
```

如果旧页面缓存明显，浏览器强刷：

```text
Mac: Cmd + Shift + R
Windows: Ctrl + F5
```

## 十五、其他项目如何接入主站

推荐模式：

```text
每个项目保留自己的 GitLab Pages 子站
transportmall/aidocs 作为主站
主站通过 search-index.js 聚合其他项目
```

例如子站：

```text
chaorong.lai/ai-docs
http://chaorong.lai.pages.sztgitlab/ai-docs/
```

子站需要生成：

```text
public/search-index.json
public/search-index.js
```

主站增加配置文件：

```text
external-indexes.json
```

示例：

```json
[
  {
    "name": "chaorong.lai/ai-docs",
    "script": "http://chaorong.lai.pages.sztgitlab/ai-docs/search-index.js"
  }
]
```

新增项目时追加：

```json
[
  {
    "name": "chaorong.lai/ai-docs",
    "script": "http://chaorong.lai.pages.sztgitlab/ai-docs/search-index.js"
  },
  {
    "name": "somegroup/some-docs",
    "script": "http://somegroup.pages.sztgitlab/some-docs/search-index.js"
  }
]
```

提交主站后，主站首页会多一个来源。

## 十六、其他项目接入步骤

新项目接入流程：

```text
1. 项目准备文档目录
2. 增加 scripts/build-vitepress.mjs
3. 增加 .gitlab-ci.yml
4. 提交 master
5. 等 CI pages job 成功
6. 访问子站 Pages 地址
7. 验证 search-index.js
8. 在 transportmall/aidocs 的 external-indexes.json 添加子站
9. 提交主站
10. 主站刷新后可统一搜索
```

子站地址规则：

```text
http://<group-or-user>.pages.sztgitlab/<project>/
```

搜索索引地址：

```text
http://<group-or-user>.pages.sztgitlab/<project>/search-index.js
```

## 十七、用户看到最新内容的时间

子站内容更新：

```text
子站 commit
  -> 子站 CI
  -> 子站 Pages 更新
  -> 用户刷新子站可见
  -> 主站运行时重新加载 search-index.js
  -> 用户刷新主站可搜索
```

如果只是子站内容变更：

```text
主站不需要重新构建
```

如果新增一个子站来源：

```text
需要修改主站 external-indexes.json
需要主站重新 CI
```

## 十八、常见问题排查

Runner pending：

```text
This job is stuck, because you don't have any active runners
```

检查：

```text
Runner 是否在线
Runner tag 是否包含 pages
项目是否启用该 Runner
Runner 是否 paused
```

CI 拉代码失败：

```text
Could not resolve host: sztgitlab
```

处理：

```text
Rancher service 增加 extra_hosts
Runner config.toml 的 [runners.docker] 增加 extra_hosts
```

Runner 启动失败：

```text
Key 'runners.docker.shm_size' has already been defined
```

处理：

```text
config.toml 删除重复 key
```

拉公网镜像失败：

```text
registry-1.docker.io timeout
```

处理：

```text
使用内网 builder 镜像
不要在 CI 里每次 npm install
```

Pages 404：

```text
检查 CI 是否成功
检查 public/ 是否有目标文件
检查 URL 是否带项目名路径
检查 DNS 是否解析到 192.168.0.242
检查文件路径是否生成了 .xxx.html 这种点开头文件
```

Markdown 展示丑：

```text
使用 VitePress 模式
不要直接发布 .md 原文件
```

Markdown 搜不到正文：

```text
.md 必须直接给 VitePress 渲染
不要用 iframe 包 .md
```

HTML 展示有空白：

```text
HTML 原文件样式导致
当前 iframe 是保真展示
要统一风格需要把 HTML 转 Markdown 或重写为 VitePress 页面
```

## 十九、当前推荐主入口

以后建议统一访问主站：

```text
http://transportmall.pages.sztgitlab/aidocs/
```

个人站或其他项目站作为子站接入主站索引：

```text
http://chaorong.lai.pages.sztgitlab/ai-docs/
```

这样文档仍然分项目维护，但用户只需要记一个主入口。
