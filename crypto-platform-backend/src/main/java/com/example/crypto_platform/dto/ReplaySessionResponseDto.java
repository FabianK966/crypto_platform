package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Antwort-DTO nach dem Speichern einer Session (oder beim Abrufen der Liste).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReplaySessionResponseDto {

    private String id;
    private LocalDateTime createdAt;

    private String symbol;
    private String intervalValue;
    private Long startTime;
    private Long endTime;
    private Integer leverage;

    private BigDecimal initialBalance;
    private BigDecimal startBalance;
    private BigDecimal finalCashBalance;
    private BigDecimal totalBalance;
    private BigDecimal realizedPnl;
    private BigDecimal totalFees;

    private BigDecimal longQuantity;
    private BigDecimal longAvgPrice;
    private BigDecimal shortQuantity;
    private BigDecimal shortAvgPrice;

    private Integer currentCandle;
    private Integer totalCandles;
    private Integer tradeCount;
}
