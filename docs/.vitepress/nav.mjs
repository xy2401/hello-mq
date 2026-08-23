// 导航与侧边栏的唯一数据源：config.ts 与 scripts/check-project.js 共同引用。
// 链接规则：'/x/y' → docs/x/y.md；'/x/' → docs/x/index.md。

export const nav = [
  { text: 'RabbitMQ', link: '/products/rabbitmq/' },
  { text: 'Kafka', link: '/products/kafka/' },
  { text: 'RocketMQ', link: '/products/rocketmq/' },
  { text: 'Pulsar', link: '/products/pulsar/' },
  { text: 'Redis Streams', link: '/products/redis-streams/' },
  {
    text: '更多',
    items: [
      { text: 'NATS JetStream', link: '/products/nats/' },
      { text: 'ActiveMQ Artemis', link: '/products/artemis/' },
      { text: 'ActiveMQ Classic', link: '/products/activemq-classic/' },
    ],
  },
  { text: '对比矩阵', link: '/matrix/' },
  { text: '试验场', link: '/playground/' },
  { text: '参考资料', link: '/reference/' },
]

const referenceSidebar = [
  {
    text: '实践入口',
    items: [
      { text: '参考资料总览', link: '/reference/' },
      { text: '快速开始', link: '/reference/getting-started' },
      { text: '学习路径', link: '/reference/learning-path' },
      { text: '实验约定', link: '/reference/lab-conventions' },
      { text: '协议资料', link: '/reference/protocols/' },
      { text: 'MQTT', link: '/reference/protocols/mqtt' },
      { text: 'AMQP 0-9-1', link: '/reference/protocols/amqp-091' },
      { text: 'AMQP 1.0', link: '/reference/protocols/amqp-10' },
      { text: 'STOMP', link: '/reference/protocols/stomp' },
      { text: 'JMS / Jakarta Messaging（API）', link: '/reference/protocols/jakarta-messaging' },
      { text: 'OpenWire', link: '/reference/protocols/openwire' },
      { text: '消息模式', link: '/reference/patterns/' },
      { text: '生产运维', link: '/reference/operations/production-checklist' },
    ],
  },
  {
    text: '治理与证据',
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
      { text: 'Docker 工具证据', link: '/matrix/docker-tools' },
      { text: '选型指南', link: '/matrix/selection-guide' },
    ],
  },
]

const experimentSidebar = [
  {
    text: '实验手册',
    items: [
      { text: '实验总览', link: '/playground/' },
      { text: '基础收发流程', link: '/playground/basic-flow' },
      { text: '消费者崩溃与重投', link: '/playground/consumer-crash' },
      { text: '毒消息、重试与 DLQ', link: '/playground/poison-message' },
      { text: '顺序、消费组与回放（Kafka）', link: '/playground/ordering' },
      { text: '积压与追赶（RabbitMQ）', link: '/playground/backlog-recovery' },
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
        { text: 'Docker 工具', link: `${base}/DockerTooling` },
      ],
    },
  ]
}

export const sidebar = {
  '/reference/': referenceSidebar,
  '/products/rabbitmq/': productDetailSidebar('RabbitMQ', '/products/rabbitmq'),
  '/products/kafka/': productDetailSidebar('Kafka', '/products/kafka'),
  '/products/rocketmq/': productDetailSidebar('RocketMQ', '/products/rocketmq'),
  '/products/pulsar/': productDetailSidebar('Pulsar', '/products/pulsar'),
  '/products/redis-streams/': productDetailSidebar('Redis Streams', '/products/redis-streams'),
  '/products/nats/': productDetailSidebar('NATS JetStream', '/products/nats'),
  '/products/artemis/': productDetailSidebar('ActiveMQ Artemis', '/products/artemis'),
  '/products/activemq-classic/': productDetailSidebar('ActiveMQ Classic', '/products/activemq-classic'),
  '/products/': productsSidebar,
  '/playground/': experimentSidebar,
  '/matrix/': matrixSidebar,
}
