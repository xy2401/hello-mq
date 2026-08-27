# Apache Pulsar 版本演进

Apache Pulsar 采用天然的计算与存储分离（Broker + Apache BookKeeper）架构，以多租户与百万分区扩展见长。

## 版本索引

### [Pulsar 4.2](./pulsar-4.2)

- **发布时间：** 2026 年 3 月
- **版本重点：** 延续 4.x 功能发布线并更新 Broker、客户端与依赖。

### [Pulsar 4.0 LTS](./pulsar-4.0)

- **发布时间：** 2024 年 10 月
- **版本重点：** 增强 KeyShared、QoS 与多租户资源管理。

### [Pulsar 3.0 LTS](./pulsar-3.0)

- **发布时间：** 2023 年 5 月
- **版本重点：** Pulsar 首个官方长期支持版本（LTS），确立企业级稳定交付承诺。

### [Pulsar 2.8](./pulsar-2.8)

- **发布时间：** 2021 年 6 月
- **版本重点：** 原生引入跨 Topic 与跨命名空间的分布式事务支持。

## 升级核对
- 跨大版本升级需先逐节点滚动升级 BookKeeper (Bookie)，再升级 Pulsar Broker 节点。
