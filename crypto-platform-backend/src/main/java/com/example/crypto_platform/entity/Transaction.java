package com.example.crypto_platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String symbol; // z.B. BTC

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private TransactionType type; // SELL (später auch BUY möglich)

    @Column(nullable = false, precision = 20, scale = 8)
    private BigDecimal quantity;

    @Column(name = "price_per_unit", nullable = false, precision = 20, scale = 2)
    private BigDecimal pricePerUnit; // Verkaufspreis pro Stück

    @Column(name = "buy_price_usd", nullable = false, precision = 20, scale = 2)
    private BigDecimal buyPriceUsd;

    @Column(name = "cost_basis", precision = 20, scale = 2)
    private BigDecimal costBasis; // Dein ursprünglicher Kaufpreis (Avg Buy Price)

    @Column(name = "realized_pnl", precision = 20, scale = 2)
    private BigDecimal realizedPnL; // (Verkaufspreis - Kaufpreis) * Menge

    @Column(nullable = false)
    private LocalDateTime timestamp;

    public enum TransactionType {
        BUY, SELL
    }
}