package com.hellomq.redisstreams;

import com.hellomq.shared.IdempotencyStore;
import com.hellomq.shared.LabLogger;

public final class InspectDb {

  public static void run(Args args) throws Exception {
    String dbPath = args.require("db");
    String lab = args.get("lab", "unknown");
    LabLogger log = LabLogger.of("inspect", "redis-streams", lab, "order-service");
    try (IdempotencyStore store = new IdempotencyStore(dbPath, lab)) {
      log.entry()
          .put("business_rows", store.businessRowCount())
          .put("processed_rows", store.processedCount())
          .status("snapshot")
          .emit();
    }
  }
}
