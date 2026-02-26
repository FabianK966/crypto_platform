package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * DTO für den "Session speichern"-Request vom Frontend.
 * Enthält den gesamten Zustand der Replay-Session im Moment des Klicks.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReplaySaveRequestDto {

    // ----- Konfiguration -----
    private String symbol;
    private String intervalValue;
    private Long startTime;
    private Long endTime;
    private Integer leverage;

    // ----- Portfolio -----
    private BigDecimal initialBalance;
    private BigDecimal startBalance;
    private BigDecimal finalCashBalance;
    private BigDecimal totalBalance;
    private BigDecimal realizedPnl;
    private BigDecimal totalFees;

    // ----- Positionen -----
    private BigDecimal longQuantity;
    private BigDecimal longAvgPrice;
    private BigDecimal longDebt;
    private BigDecimal shortQuantity;
    private BigDecimal shortAvgPrice;

    // ----- Fortschritt -----
    private Integer currentCandle;
    private Integer totalCandles;

    // ----- Historien (werden im Service zu JSON serialisiert) -----
    private List<Map<String, Object>> tradeHistory;
    private List<Map<String, Object>> depositHistory;
}
