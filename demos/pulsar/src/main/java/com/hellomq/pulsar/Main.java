package com.hellomq.pulsar;

import com.hellomq.shared.LabLogger;

public final class Main {

  public static void main(String[] args) throws Exception {
    if (args.length == 0) {
      System.err.println("usage: hello-mq-pulsar <setup|produce|consume|inspect-db> [--key=value ...]");
      System.exit(2);
    }
    String command = args[0];
    String[] rest = new String[args.length - 1];
    System.arraycopy(args, 1, rest, 0, rest.length);
    Args parsed = Args.parse(rest);

    switch (command) {
      case "setup" -> {
        // Topic 由首次生产/消费自动创建（standalone allowAutoTopicCreation 默认开启）；
        // 这里仅记录拓扑意图，保持四产品 CLI 对称。
        LabLogger log = LabLogger.of("setup", "pulsar", parsed.get("lab", "unknown"), "order-service");
        log.entry().status("noop").emit();
      }
      case "produce" -> Producer.run(parsed);
      case "consume" -> Consumer.run(parsed);
      case "inspect-db" -> InspectDb.run(parsed);
      default -> {
        System.err.println("unknown command: " + command);
        System.exit(2);
      }
    }
  }
}
