package com.example.crypto_platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "portfolio_assets")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PortfolioAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String symbol;  // BTC, ETH, etc.

    @Column(nullable = false, precision = 20, scale = 8)
    private BigDecimal quantity;  // Menge

    @Column(name = "avg_buy_price_eur", precision = 20, scale = 2)
    private BigDecimal avgBuyPriceEur;  // Durchschnittlicher Kaufpreis in EUR

    @Column(name = "avg_buy_price_usd", precision = 20, scale = 2)
    private BigDecimal avgBuyPriceUsd;  // Durchschnittlicher Kaufpreis in USD

    @Column(name = "total_realized_profit", precision = 20, scale = 2)
    private BigDecimal totalRealizedProfit;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}