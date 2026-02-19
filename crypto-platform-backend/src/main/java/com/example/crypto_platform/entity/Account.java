package com.example.crypto_platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "account")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Initial Balance (Cash) - kann manuell erhöht/reduziert werden
     * Das ist dein "freies Geld" zum Investieren
     */
    @Column(name = "initial_balance", nullable = false, precision = 20, scale = 2)
    private BigDecimal initialBalance = BigDecimal.ZERO;

    /**
     * Total Realized Profit über alle Assets hinweg
     */
    @Column(name = "total_realized_profit", nullable = false, precision = 20, scale = 2)
    private BigDecimal totalRealizedProfit = BigDecimal.ZERO;

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