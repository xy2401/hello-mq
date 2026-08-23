// 导航与侧边栏的唯一数据源：config.ts 与 scripts/check-project.js 共同引用。
// 链接规则：'/x/y' → docs/x/y.md；'/x/' → docs/x/index.md。

export const nav = [
  // 前 5 个典型消息队列全部平铺在主导航
  { text: 'RabbitMQ', link: '/products/rabbitmq/' },
  { text: 'Kafka', link: '/products/kafka/' },
  { text: 'RocketMQ', link: '/products/rocketmq/' },
  { text: 'Pulsar', link: '/products/pulsar/' },
  { text: 'Redis Streams', link: '/products/redis-streams/' },
  // 第 6 个起在「更多」下拉中展开选择
  {
    text: '更多',
    items: [
      { text: 'NATS JetStream', link: '/products/nats/' },
      { text: 'ActiveMQ Artemis', link: '/products/artemis/' },
      { text: 'ActiveMQ Classic', link: '/products/activemq-classic/' },
    ],
  },
  { text: '基础概念', link: '/concepts/' },
  { text: '对比矩阵', link: '/matrix/' },
]

const conceptsSidebar = [
  {
    text: '基础概念',
    items: [
      { text: '总览', link: '/concepts/' },
      { text: '为什么需要异步消息', link: '/concepts/why-messaging' },
      { text: '消息模型', link: '/concepts/models' },
      { text: '投递语义', link: '/concepts/delivery-semantics' },
      { text: '顺序语义', link: '/concepts/ordering' },
      { text: '存储与回放', link: '/concepts/storage-and-replay' },
      { text: '背压与积压', link: '/concepts/backpressure' },
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
]

const experimentSidebar = [
  {
    text: '实验手册',
    items: [
      { text: '实验总览', link: '/matrix/experiment/' },
      { text: '基础收发流程', link: '/matrix/experiment/basic-flow' },
      { text: '消费者崩溃与重投', link: '/matrix/experiment/consumer-crash' },
      { text: '毒消息、重试与 DLQ', link: '/matrix/experiment/poison-message' },
      { text: '顺序、消费组与回放（Kafka）', link: '/matrix/experiment/ordering' },
      { text: '积压与追赶（RabbitMQ）', link: '/matrix/experiment/backlog-recovery' },
    ],
  },
]

const productsSidebar = [
  {
    text: '产品分卷',
    items: [
      { text: '总览', link: '/products/' },
      { text: 'RabbitMQ', link: '/products/rabbitmq/' },
      { text: 'Kafka', link: '/products/kafka/' },
      { text: 'RocketMQ', link: '/products/rocketmq/' },
      { text: 'Pulsar', link: '/products/pulsar/' },
      { text: 'Redis Streams', link: '/products/redis-streams/' },
      { text: 'NATS', link: '/products/nats/' },
      { text: 'ActiveMQ Artemis', link: '/products/artemis/' },
      { text: 'ActiveMQ Classic', link: '/products/activemq-classic/' },
    ],
  },
]

function productDetailSidebar(productName, base) {
  return [
    {
      text: productName,
      items: [
        { text: '总览', link: `${base}/` },
        { text: 'CLI 工具', link: `${base}/cli` },
        { text: '快速开始', link: `${base}/quick-start` },
        { text: '核心概念映射', link: `${base}/concepts` },
        { text: '路由与分发', link: `${base}/routing` },
        { text: '可靠性', link: `${base}/reliability` },
        { text: '存储与高可用', link: `${base}/storage-ha` },
        { text: '运维与观测', link: `${base}/operations` },
        { text: '陷阱与检查表', link: `${base}/pitfalls` },
      ],
    },
  ]
}

export const sidebar = {
  '/concepts/': conceptsSidebar,
  '/reference/': conceptsSidebar,
  '/products/rabbitmq/': productDetailSidebar('RabbitMQ', '/products/rabbitmq'),
  '/products/kafka/': productDetailSidebar('Kafka', '/products/kafka'),
  '/products/rocketmq/': productDetailSidebar('RocketMQ', '/products/rocketmq'),
  '/products/pulsar/': productDetailSidebar('Pulsar', '/products/pulsar'),
  '/products/redis-streams/': productDetailSidebar('Redis Streams', '/products/redis-streams'),
  '/products/nats/': productDetailSidebar('NATS JetStream', '/products/nats'),
  '/products/artemis/': productDetailSidebar('ActiveMQ Artemis', '/products/artemis'),
  '/products/activemq-classic/': productDetailSidebar('ActiveMQ Classic', '/products/activemq-classic'),
  '/products/': productsSidebar,
  '/matrix/experiment/': experimentSidebar,
  '/matrix/': matrixSidebar,
}
