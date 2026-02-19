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
    private String symbol;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private TransactionType type;

    @Column(nullable = false, precision = 20, scale = 8)
    private BigDecimal quantity;

    @Column(name = "price_per_unit", nullable = false, precision = 20, scale = 2)
    private BigDecimal pricePerUnit;

    @Column(name = "buy_price_usd", nullable = false, precision = 20, scale = 2)
    private BigDecimal buyPriceUsd;

    @Column(name = "cost_basis", precision = 20, scale = 2)
    private BigDecimal costBasis;

    @Column(name = "realized_pnl", precision = 20, scale = 2)
    private BigDecimal realizedPnL;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    public enum TransactionType {
        BUY, SELL
    }
}