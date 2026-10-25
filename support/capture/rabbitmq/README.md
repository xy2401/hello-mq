# Erlang / RabbitMQ 镜像与文件采集

本目录由 Hello MQ 维护 Erlang 27.3.4.3、RabbitMQ 4.1.4 的安装、版本、案例和采集入口。公共 Ubuntu 基线与 Bash 采集工具由 Hello Docker 提供；页面读取本站生成的展示包，既有 Docker 实验和历史证据保留。

镜像关系：`公共 Ubuntu 26.04 → Erlang → RabbitMQ`。两个独立 Dockerfile 形成可复用镜像；`build.sh` 明确先构建 Erlang、再构建 RabbitMQ，不使用 `depends_on` 推断构建顺序。完整扫描可区分 Ubuntu→Erlang、Erlang→RabbitMQ 及 Ubuntu→RabbitMQ 总差异。Erlang 和 apt 编译依赖不会成为 RabbitMQ 产品命令。

归档来源和 SHA-256 固定在 `recipe.json`，安装先校验再编译/解压。apt 依赖先记录解析出的下载地址和 SHA-256，再下载、核验、离线安装。Erlang 默认使用两个编译进程，可设置 `BUILD_JOBS`；镜像中保留依赖证据、源包文件表和实际 apt 版本。apt 包名不是固定版本，重新解析仓库需要建立新采集批次。

在本地 Linux / WSL2 执行，默认 rootless Podman，需 Compose provider（例如 podman-compose）、Node.js 22 和 Bash；也可设 `ENGINE=docker`。

```bash
# 从 Hello MQ 仓库根目录运行。
export HELLO_DOCKER_HOME=/absolute/path/to/hello-docker
export ENGINE=podman
export BASE_IMAGE=localhost/hello-capture/ubuntu:26.04

# 基线已有时跳过，可和 Java/MongoDB 共用。
bash "$HELLO_DOCKER_HOME/support/capture/ubuntu/build.sh"

# 只构建；每次使用新目录，保留 Erlang/RabbitMQ 分开的构建日志。
export BUILD_OUTPUT_DIR="$PWD/support/capture/rabbitmq/.local/builds/rabbit-4.1.4-first"
bash support/capture/rabbitmq/build.sh

bash support/capture/rabbitmq/capture.sh \
  --tools "$HELLO_DOCKER_HOME" \
  --images "$BUILD_OUTPUT_DIR/images.json" \
  --workspace "$PWD/support/capture/rabbitmq/.local/runs/rabbit-4.1.4-first"
```

`ERLANG_IMAGE`、`RABBITMQ_IMAGE` 可覆盖镜像标签。采集读取构建记录内的不可变镜像 ID；recipe 改动后要求重新构建。公共工具只接收阶段镜像、recipe 和输出目录，不接收 RabbitMQ 产品开关。

只有一个读写挂载 `/capture`，准备脚本从 `/capture/scripts/product/prepare.sh` 读取，所有临时节点数据和 cookie 放在 `/capture/work`。准备过程只启动一次节点；全部案例共享该新容器，覆盖版本、节点状态、虚拟主机、用户权限和插件列表，结束或失败时停止节点。节点名称按本次容器主机名设置，不依赖宿主 DNS 或外部集群。

完成校验后可追加 `--site <本站展示包目录>`。原始清单、差分、步骤输出、退出码及构建证据归 Hello MQ 保存；本地 `.local` 不自动进入 Git。手动工作流 `collect-rabbitmq-capture.yml` 要求已发布的 Hello Docker 完整提交 SHA，只上传产物，不自动提交、推送或发布镜像。Erlang 源码构建耗时明显高于 MongoDB。

