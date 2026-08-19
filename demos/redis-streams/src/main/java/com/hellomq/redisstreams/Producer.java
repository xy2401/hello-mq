package com.hellomq.redisstreams;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.StreamEntryID;
import redis.clients.jedis.params.XAddParams;

/**
 * 生产者：XADD 逐条写入（服务端返回 Entry ID 即写入成功）。条目字段同时携带
 * 契约标头与完整信封 JSON（规格 §5.2/§5.3）。
 */
public final class Producer {

  public static void run(Args args) throws Exception {
    String lab = args.get("lab", "unknown");
    String stream = args.require("stream");
    Path fixturesDir = Path.of(args.get("fixtures", "demos/shared/fixtures"));
    List<String> files = List.of(args.require("files").split(","));

    LabLogger log = LabLogger.of("producer", "redis-streams", lab, "order-service");
    try (Jedis jedis = Broker.connect(Broker.DEFAULT_HOST, Broker.DEFAULT_PORT)) {
      int confirmed = 0;
      for (String file : files) {
        String body = Files.readString(fixturesDir.resolve(file));
        Envelope envelope = Json.mapper().readValue(body, Envelope.class);

        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("messageId", envelope.getMessageId());
        fields.put("eventType", envelope.getEventType());
        fields.put("aggregateId", envelope.getAggregateId());
        fields.put("traceId", envelope.getTraceId());
        fields.put("correlationId", envelope.getCorrelationId());
        fields.put("data", body);

        long start = System.nanoTime();
        StreamEntryID entryId = jedis.xadd(stream, XAddParams.xAddParams(), fields);
        log.entry()
            .envelope(envelope)
            .put("destination", stream)
            .put("entryId", entryId.toString())
            .duration(start)
            .status("confirmed")
            .emit();
        confirmed++;
      }
      log.entry().put("destination", stream).put("confirmed", confirmed).status("done").emit();
    }
  }
}
