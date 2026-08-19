package com.hellomq.rabbitmq;

import com.rabbitmq.client.Connection;

public final class Main {

  public static void main(String[] args) throws Exception {
    if (args.length == 0) {
      System.err.println("usage: hello-mq-rabbitmq <setup|produce|consume|inspect-db> [--key=value ...]");
      System.exit(2);
    }
    String command = args[0];
    String[] rest = new String[args.length - 1];
    System.arraycopy(args, 1, rest, 0, rest.length);
    Args parsed = Args.parse(rest);

    switch (command) {
      case "setup" -> {
        try (Connection connection = Broker.connect(parsed.get("uri", Broker.DEFAULT_URI))) {
          Topology.setup(parsed.require("lab"), connection);
        }
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
