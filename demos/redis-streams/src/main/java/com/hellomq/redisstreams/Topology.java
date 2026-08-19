package com.hellomq.redisstreams;

import redis.clients.jedis.Jedis;
import redis.clients.jedis.StreamEntryID;

/**
 * 实验拓扑声明（规格 §9.4-5）。basic 组从 "$" 开始（只接收组建之后的新条目）；
 * consumer-crash 组从 "0" 开始（可消费组创建前已存在的全部条目）。
 */
public final class Topology {

  public static final String STREAM_BASIC = "orders.basic";
  public static final String GROUP_BASIC = "orders-basic-group";
  public static final String STREAM_CRASH = "orders.crash";
  public static final String GROUP_CRASH = "orders-crash-group";

  private Topology() {}

  public static void setup(Args args) {
    String lab = args.require("lab");
    try (Jedis jedis = Broker.connect(Broker.DEFAULT_HOST, Broker.DEFAULT_PORT)) {
      switch (lab) {
        case "basic" -> jedis.xgroupCreate(STREAM_BASIC, GROUP_BASIC, StreamEntryID.XGROUP_LAST_ENTRY, true);
        case "consumer-crash" -> jedis.xgroupCreate(STREAM_CRASH, GROUP_CRASH, new StreamEntryID("0-0"), true);
        default -> throw new IllegalArgumentException("unknown lab for setup: " + lab);
      }
    }
  }
}
