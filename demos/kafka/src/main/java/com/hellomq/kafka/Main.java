package com.hellomq.kafka;

public final class Main {

  public static void main(String[] args) throws Exception {
    if (args.length == 0) {
      System.err.println("usage: hello-mq-kafka <setup|produce|consume|inspect-db> [--key=value ...]");
      System.exit(2);
    }
    String command = args[0];
    String[] rest = new String[args.length - 1];
    System.arraycopy(args, 1, rest, 0, rest.length);
    Args parsed = Args.parse(rest);
    String bootstrap = parsed.get("bootstrap", Broker.DEFAULT_BOOTSTRAP);

    switch (command) {
      case "setup" -> Topology.setup(parsed.require("lab"), bootstrap);
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
