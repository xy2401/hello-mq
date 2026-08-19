package com.hellomq.redisstreams;

import com.hellomq.shared.LabLogger;
import redis.clients.jedis.Jedis;

/** Broker 状态探针：Stream 长度与 Consumer Group Pending 数（结构化输出供实验断言）。 */
public final class Stats {

  public static void run(Args args) {
    String lab = args.get("lab", "unknown");
    String stream = args.require("stream");
    String group = args.get("group", null);
    LabLogger log = LabLogger.of("inspect", "redis-streams", lab, "order-service");
    try (Jedis jedis = Broker.connect(Broker.DEFAULT_HOST, Broker.DEFAULT_PORT)) {
      long streamLength = jedis.xlen(stream);
      long pending = group == null ? 0 : jedis.xpending(stream, group).getTotal();
      log.entry()
          .put("destination", stream)
          .put("streamLength", streamLength)
          .put("pending", pending)
          .status("snapshot")
          .emit();
    }
  }
}
