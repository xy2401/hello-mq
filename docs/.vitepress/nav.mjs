// 导航与侧边栏的唯一数据源：config.ts 与 scripts/check-project.js 共同引用。
// 链接规则：'/x/y' → docs/x/y.md；'/x/' → docs/x/index.md。

export const nav = [
  { text: '基础原理', link: '/fundamentals/' },
  { text: '产品分卷', link: '/brokers/' },
  { text: '横向矩阵', link: '/matrix/' },
  { text: '运维实践', link: '/operations/observability' },
]

const fundamentalsSidebar = [
  {
    text: '基础原理',
    items: [
      { text: '总览', link: '/fundamentals/' },
      { text: '为什么需要异步消息', link: '/fundamentals/why-messaging' },
      { text: '消息模型', link: '/fundamentals/models' },
      { text: '投递语义', link: '/fundamentals/delivery-semantics' },
      { text: '顺序语义', link: '/fundamentals/ordering' },
      { text: '存储与回放', link: '/fundamentals/storage-and-replay' },
      { text: '背压与积压', link: '/fundamentals/backpressure' },
    ],
  },
  {
    text: '动手实验',
    items: [
      { text: '实验总览', link: '/labs/' },
      { text: '基础收发流程', link: '/labs/basic-flow' },
      { text: '消费者崩溃与重投', link: '/labs/consumer-crash' },
      { text: '毒消息、重试与 DLQ', link: '/labs/poison-message' },
      { text: '顺序、消费组与回放（Kafka）', link: '/labs/ordering' },
      { text: '积压与追赶（RabbitMQ）', link: '/labs/backlog-recovery' },
    ],
  },
  {
    text: '参考',
    items: [
      { text: '统一术语表', link: '/reference/glossary' },
      { text: '版本政策', link: '/reference/version-policy' },
      { text: '证据政策', link: '/reference/evidence-policy' },
      { text: '官方资料基线', link: '/reference/sources' },
    ],
  },
]

const matrixSidebar = [
  {
    text: '横向矩阵',
    items: [
      { text: '总览与读法', link: '/matrix/' },
      { text: '投递语义', link: '/matrix/delivery-semantics' },
      { text: '顺序', link: '/matrix/ordering' },
      { text: '重试与 DLQ', link: '/matrix/retry-dlq' },
      { text: '延迟与定时消息', link: '/matrix/delayed-messages' },
      { text: '回放与保留', link: '/matrix/replay-retention' },
      { text: '存储、高可用与扩展', link: '/matrix/storage-ha-scaling' },
      { text: '安全', link: '/matrix/security' },
      { text: '运维与观测', link: '/matrix/operations' },
      { text: '自带 CLI', link: '/matrix/cli-tools' },
      { text: '选型指南', link: '/matrix/selection-guide' },
    ],
  },
  {
    text: '可靠消息模式',
    items: [
      { text: '模式总览', link: '/patterns/' },
      { text: '工作队列', link: '/patterns/work-queue' },
      { text: '发布-订阅', link: '/patterns/pub-sub' },
      { text: '请求-应答', link: '/patterns/request-reply' },
      { text: 'Outbox', link: '/patterns/outbox' },
      { text: '幂等消费', link: '/patterns/idempotent-consumer' },
      { text: '重试与 DLQ', link: '/patterns/retry-and-dlq' },
      { text: 'Saga', link: '/patterns/saga' },
      { text: 'Schema 演进', link: '/patterns/schema-evolution' },
    ],
  },
]

export const sidebar = {
  '/guide/': [
    {
      text: '指南',
      items: [
        { text: '快速开始', link: '/guide/getting-started' },
        { text: '学习路径', link: '/guide/learning-path' },
        { text: '实验约定', link: '/guide/lab-conventions' },
      ],
    },
  ],
  '/fundamentals/': fundamentalsSidebar,
  '/labs/': fundamentalsSidebar,
  '/reference/': fundamentalsSidebar,
  '/brokers/': [
    {
      text: '产品分卷',
      items: [
        { text: '总览', link: '/brokers/' },
        { text: 'RabbitMQ', link: '/brokers/rabbitmq/' },
        { text: 'Kafka', link: '/brokers/kafka/' },
        { text: 'RocketMQ', link: '/brokers/rocketmq/' },
        { text: 'Pulsar', link: '/brokers/pulsar/' },
        { text: 'Redis Streams', link: '/brokers/redis-streams/' },
        { text: 'NATS', link: '/brokers/nats/' },
        { text: 'ActiveMQ Artemis', link: '/brokers/artemis/' },
        { text: 'ActiveMQ Classic', link: '/brokers/activemq-classic/' },
      ],
    },
  ],
  '/brokers/rabbitmq/': [
    {
      text: 'RabbitMQ',
      items: [
        { text: '总览', link: '/brokers/rabbitmq/' },
        { text: 'CLI 工具', link: '/brokers/rabbitmq/cli' },
        { text: '快速开始', link: '/brokers/rabbitmq/quick-start' },
        { text: '核心概念映射', link: '/brokers/rabbitmq/concepts' },
        { text: '路由与分发', link: '/brokers/rabbitmq/routing' },
        { text: '可靠性', link: '/brokers/rabbitmq/reliability' },
        { text: '存储与高可用', link: '/brokers/rabbitmq/storage-ha' },
        { text: '运维与观测', link: '/brokers/rabbitmq/operations' },
        { text: '陷阱与检查表', link: '/brokers/rabbitmq/pitfalls' },
      ],
    },
  ],
  '/brokers/kafka/': [
    {
      text: 'Kafka',
      items: [
        { text: '总览', link: '/brokers/kafka/' },
        { text: 'CLI 工具', link: '/brokers/kafka/cli' },
        { text: '快速开始', link: '/brokers/kafka/quick-start' },
        { text: '核心概念映射', link: '/brokers/kafka/concepts' },
        { text: '分区与分发', link: '/brokers/kafka/routing' },
        { text: '可靠性', link: '/brokers/kafka/reliability' },
        { text: '存储与高可用', link: '/brokers/kafka/storage-ha' },
        { text: '运维与观测', link: '/brokers/kafka/operations' },
        { text: '陷阱与检查表', link: '/brokers/kafka/pitfalls' },
      ],
    },
  ],
  '/brokers/rocketmq/': [
    {
      text: 'RocketMQ',
      items: [
        { text: '总览', link: '/brokers/rocketmq/' },
        { text: 'CLI 工具', link: '/brokers/rocketmq/cli' },
        { text: '快速开始', link: '/brokers/rocketmq/quick-start' },
        { text: '核心概念映射', link: '/brokers/rocketmq/concepts' },
        { text: '路由与分发', link: '/brokers/rocketmq/routing' },
        { text: '可靠性', link: '/brokers/rocketmq/reliability' },
        { text: '存储与高可用', link: '/brokers/rocketmq/storage-ha' },
        { text: '运维与观测', link: '/brokers/rocketmq/operations' },
        { text: '陷阱与检查表', link: '/brokers/rocketmq/pitfalls' },
      ],
    },
  ],
  '/brokers/pulsar/': [
    {
      text: 'Pulsar',
      items: [
        { text: '总览', link: '/brokers/pulsar/' },
        { text: 'CLI 工具', link: '/brokers/pulsar/cli' },
        { text: '快速开始', link: '/brokers/pulsar/quick-start' },
        { text: '核心概念映射', link: '/brokers/pulsar/concepts' },
        { text: '订阅与分发', link: '/brokers/pulsar/routing' },
        { text: '可靠性', link: '/brokers/pulsar/reliability' },
        { text: '存储与高可用', link: '/brokers/pulsar/storage-ha' },
        { text: '运维与观测', link: '/brokers/pulsar/operations' },
        { text: '陷阱与检查表', link: '/brokers/pulsar/pitfalls' },
      ],
    },
  ],
  '/brokers/redis-streams/': [
    {
      text: 'Redis Streams',
      items: [
        { text: '总览', link: '/brokers/redis-streams/' },
        { text: 'CLI 工具', link: '/brokers/redis-streams/cli' },
        { text: '快速开始', link: '/brokers/redis-streams/quick-start' },
        { text: '核心概念映射', link: '/brokers/redis-streams/concepts' },
        { text: '路由与分发', link: '/brokers/redis-streams/routing' },
        { text: '可靠性', link: '/brokers/redis-streams/reliability' },
        { text: '存储与高可用', link: '/brokers/redis-streams/storage-ha' },
        { text: '运维与观测', link: '/brokers/redis-streams/operations' },
        { text: '陷阱与检查表', link: '/brokers/redis-streams/pitfalls' },
      ],
    },
  ],
  '/brokers/nats/': [
    {
      text: 'NATS',
      items: [
        { text: '总览', link: '/brokers/nats/' },
        { text: 'CLI 工具', link: '/brokers/nats/cli' },
        { text: '快速开始', link: '/brokers/nats/quick-start' },
        { text: '核心概念映射', link: '/brokers/nats/concepts' },
        { text: '路由与分发', link: '/brokers/nats/routing' },
        { text: '可靠性', link: '/brokers/nats/reliability' },
        { text: '存储与高可用', link: '/brokers/nats/storage-ha' },
        { text: '运维与观测', link: '/brokers/nats/operations' },
        { text: '陷阱与检查表', link: '/brokers/nats/pitfalls' },
      ],
    },
  ],
  '/brokers/artemis/': [
    {
      text: 'ActiveMQ Artemis',
      items: [
        { text: '总览', link: '/brokers/artemis/' },
        { text: 'CLI 工具', link: '/brokers/artemis/cli' },
        { text: '快速开始', link: '/brokers/artemis/quick-start' },
        { text: '核心概念映射', link: '/brokers/artemis/concepts' },
        { text: '路由与分发', link: '/brokers/artemis/routing' },
        { text: '可靠性', link: '/brokers/artemis/reliability' },
        { text: '存储与高可用', link: '/brokers/artemis/storage-ha' },
        { text: '运维与观测', link: '/brokers/artemis/operations' },
        { text: '陷阱与检查表', link: '/brokers/artemis/pitfalls' },
      ],
    },
  ],
  '/brokers/activemq-classic/': [
    {
      text: 'ActiveMQ Classic',
      items: [
        { text: '总览', link: '/brokers/activemq-classic/' },
        { text: 'CLI 工具', link: '/brokers/activemq-classic/cli' },
        { text: '快速开始', link: '/brokers/activemq-classic/quick-start' },
        { text: '核心概念映射', link: '/brokers/activemq-classic/concepts' },
        { text: '路由与分发', link: '/brokers/activemq-classic/routing' },
        { text: '可靠性', link: '/brokers/activemq-classic/reliability' },
        { text: '存储与高可用', link: '/brokers/activemq-classic/storage-ha' },
        { text: '运维与观测', link: '/brokers/activemq-classic/operations' },
        { text: '陷阱与检查表', link: '/brokers/activemq-classic/pitfalls' },
      ],
    },
  ],
  '/matrix/': matrixSidebar,
  '/patterns/': matrixSidebar,
  '/operations/': [
    {
      text: '运维实践',
      items: [
        { text: '观测与积压定位', link: '/operations/observability' },
        { text: '安全基线', link: '/operations/security' },
        { text: '容量规划', link: '/operations/capacity-planning' },
        { text: '故障剧本', link: '/operations/failure-playbook' },
        { text: '生产检查表', link: '/operations/production-checklist' },
      ],
    },
  ],
}
