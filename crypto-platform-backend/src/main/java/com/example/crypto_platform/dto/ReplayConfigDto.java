// src/main/java/com/example/crypto_platform/dto/ReplayConfigDto.java
package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReplayConfigDto {
    private String symbol;           // BTC, ETH, etc.
    private String interval;         // 1m, 5m, 15m, 30m, 1h
    private Long startTime;          // Unix timestamp
    private Long endTime;            // Unix timestamp
}