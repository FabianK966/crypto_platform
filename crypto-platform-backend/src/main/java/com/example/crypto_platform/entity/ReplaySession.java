package com.example.crypto_platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * JPA-Entity für eine gespeicherte Replay/Backtesting-Session.
 * Vollständig unabhängig von den übrigen Tabellen (account, transactions, etc.).
 */
@Entity
@Table(name = "replay_session")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReplaySession {

    @Id
    @Column(name = "id", length = 36, nullable = false, updatable = false)
    private String id;                          // UUID – wird im Service gesetzt

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // ----- Konfiguration -----
    @Column(name = "symbol", length = 20, nullable = false)
    private String symbol;

    @Column(name = "interval_value", length = 10, nullable = false)
    private String intervalValue;

    @Column(name = "start_time", nullable = false)
    private Long startTime;

    @Column(name = "end_time", nullable = false)
    private Long endTime;

    @Column(name = "leverage", nullable = false)
    private Integer leverage;

    // ----- Portfolio-Zustand -----
    @Column(name = "initial_balance", nullable = false, precision = 20, scale = 8)
    private BigDecimal initialBalance;

    @Column(name = "start_balance", nullable = false, precision = 20, scale = 8)
    private BigDecimal startBalance;

    @Column(name = "final_cash_balance", nullable = false, precision = 20, scale = 8)
    private BigDecimal finalCashBalance;

    @Column(name = "total_balance", nullable = false, precision = 20, scale = 8)
    private BigDecimal totalBalance;

    @Column(name = "realized_pnl", nullable = false, precision = 20, scale = 8)
    private BigDecimal realizedPnl;

    @Column(name = "total_fees", nullable = false, precision = 20, scale = 8)
    private BigDecimal totalFees;

    // ----- Offene Positionen -----
    @Column(name = "long_quantity", nullable = false, precision = 20, scale = 8)
    private BigDecimal longQuantity;

    @Column(name = "long_avg_price", nullable = false, precision = 20, scale = 8)
    private BigDecimal longAvgPrice;

    @Column(name = "long_debt", nullable = false, precision = 20, scale = 8)
    private BigDecimal longDebt;

    @Column(name = "short_quantity", nullable = false, precision = 20, scale = 8)
    private BigDecimal shortQuantity;

    @Column(name = "short_avg_price", nullable = false, precision = 20, scale = 8)
    private BigDecimal shortAvgPrice;

    // ----- Fortschritt -----
    @Column(name = "current_candle", nullable = false)
    private Integer currentCandle;

    @Column(name = "total_candles", nullable = false)
    private Integer totalCandles;

    @Column(name = "trade_count", nullable = false)
    private Integer tradeCount;

    // ----- Historien (JSON) -----
    @Lob
    @Column(name = "trade_history", columnDefinition = "LONGTEXT")
    private String tradeHistory;                // Serialisierter JSON-Array

    @Lob
    @Column(name = "deposit_history", columnDefinition = "LONGTEXT")
    private String depositHistory;              // Serialisierter JSON-Array
}
