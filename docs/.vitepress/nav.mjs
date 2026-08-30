// 导航与侧边栏的唯一数据源：config.ts 与 scripts/check-project.js 共同引用。
// 链接规则：'/x/y' → docs/x/y.md；'/x/' → docs/x/index.md。

export const nav = [
  { text: 'RabbitMQ', link: '/products/rabbitmq/' },
  { text: 'Kafka', link: '/products/kafka/' },
  { text: 'RocketMQ', link: '/products/rocketmq/' },
  { text: 'Pulsar', link: '/products/pulsar/' },
  { text: 'Redis Streams', link: '/products/redis-streams/' },
  {
    text: '📦 更多',
    items: [
      { text: 'NATS JetStream', link: '/products/nats/' },
      { text: 'ActiveMQ Artemis', link: '/products/artemis/' },
      { text: 'ActiveMQ Classic', link: '/products/activemq-classic/' },
    ],
  },
  { text: '🧪 实验台', link: '/playground/' },
  { text: '⚖️ 对比矩阵', link: '/matrix/' },
  { text: '📚 参考资料', link: '/reference/' },
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
      { text: 'Docker 验证证据', link: '/matrix/docker-tools' },
      { text: '选型指南', link: '/matrix/selection-guide' },
    ],
  },
]

const experimentSidebar = [
  {
    text: '消息语义实验台',
    items: [
      { text: '全部回放', link: '/playground/' },
      { text: 'RabbitMQ', link: '/playground/rabbitmq' },
      { text: 'Kafka', link: '/playground/kafka' },
      { text: 'Redis Streams', link: '/playground/redis-streams' },
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

const productVersionItems = {
  'activemq-classic': [
    { text: "ActiveMQ Classic 6.3", link: '/products/activemq-classic/version/activemq-classic-6.3' },
    { text: "ActiveMQ Classic 6.1", link: '/products/activemq-classic/version/activemq-classic-6.1' },
    { text: "ActiveMQ Classic 5.18", link: '/products/activemq-classic/version/activemq-classic-5.18' },
  ],
  'artemis': [
    { text: "Artemis 2.42", link: '/products/artemis/version/artemis-2.42' },
    { text: "Artemis 2.36+", link: '/products/artemis/version/artemis-2.36' },
    { text: "Artemis 2.0", link: '/products/artemis/version/artemis-2.0' },
  ],
  'kafka': [
    { text: "Kafka 4.2", link: '/products/kafka/version/kafka-4.2' },
    { text: "Kafka 4.0", link: '/products/kafka/version/kafka-4.0' },
    { text: "Kafka 3.8", link: '/products/kafka/version/kafka-3.8' },
    { text: "Kafka 3.5 / 3.6", link: '/products/kafka/version/kafka-3.5-3.6' },
    { text: "Kafka 3.0", link: '/products/kafka/version/kafka-3.0' },
    { text: "Kafka 2.8", link: '/products/kafka/version/kafka-2.8' },
    { text: "Kafka 0.11", link: '/products/kafka/version/kafka-0.11' },
  ],
  'nats': [
    { text: "NATS 2.14", link: '/products/nats/version/nats-2.14' },
    { text: "NATS 2.12", link: '/products/nats/version/nats-2.12' },
    { text: "NATS 2.10", link: '/products/nats/version/nats-2.10' },
    { text: "NATS 2.2 (JetStream 正式发布)", link: '/products/nats/version/nats-2.2' },
  ],
  'pulsar': [
    { text: "Pulsar 4.2", link: '/products/pulsar/version/pulsar-4.2' },
    { text: "Pulsar 4.0 LTS", link: '/products/pulsar/version/pulsar-4.0' },
    { text: "Pulsar 3.0 LTS", link: '/products/pulsar/version/pulsar-3.0' },
    { text: "Pulsar 2.8", link: '/products/pulsar/version/pulsar-2.8' },
  ],
  'rabbitmq': [
    { text: "RabbitMQ 4.3", link: '/products/rabbitmq/version/rabbitmq-4.3' },
    { text: "RabbitMQ 4.2", link: '/products/rabbitmq/version/rabbitmq-4.2' },
    { text: "RabbitMQ 4.0", link: '/products/rabbitmq/version/rabbitmq-4.0' },
    { text: "RabbitMQ 3.13", link: '/products/rabbitmq/version/rabbitmq-3.13' },
    { text: "RabbitMQ 3.12", link: '/products/rabbitmq/version/rabbitmq-3.12' },
    { text: "RabbitMQ 3.8", link: '/products/rabbitmq/version/rabbitmq-3.8' },
  ],
  'redis-streams': [
    { text: "Redis 8.x Streams", link: '/products/redis-streams/version/redis-8.x-streams' },
    { text: "Redis 7.0 (Streams)", link: '/products/redis-streams/version/redis-7.0' },
    { text: "Redis 6.2 (Streams)", link: '/products/redis-streams/version/redis-6.2' },
    { text: "Redis 5.0 (Streams 诞生)", link: '/products/redis-streams/version/redis-5.0' },
  ],
  'rocketmq': [
    { text: "RocketMQ 5.5", link: '/products/rocketmq/version/rocketmq-5.5' },
    { text: "RocketMQ 5.4", link: '/products/rocketmq/version/rocketmq-5.4' },
    { text: "RocketMQ 5.3", link: '/products/rocketmq/version/rocketmq-5.3' },
    { text: "RocketMQ 5.0", link: '/products/rocketmq/version/rocketmq-5.0' },
    { text: "RocketMQ 4.5", link: '/products/rocketmq/version/rocketmq-4.5' },
  ],
};

function productDetailSidebar(productName, base) {
  return [
    {
      text: productName,
      items: [
        { text: '总览', link: `${base}/` },
        { text: '安装与切换', link: `${base}/install` },
        { text: 'CLI 工具', link: `${base}/cli` },
        { text: '快速开始', link: `${base}/quick-start` },
        { text: '核心概念映射', link: `${base}/concepts` },
        { text: '路由与分发', link: `${base}/routing` },
        { text: '可靠性', link: `${base}/reliability` },
        { text: '存储与高可用', link: `${base}/storage-ha` },
        { text: '运维与观测', link: `${base}/operations` },
        { text: '陷阱与检查表', link: `${base}/pitfalls` },
        { text: '版本演进', link: `${base}/version/`, collapsed: false, items: productVersionItems[base.split('/').at(-1)] },
        { text: 'Docker 验证', link: `${base}/DockerTooling` },
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
