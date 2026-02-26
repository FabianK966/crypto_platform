package com.example.crypto_platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;


@Entity
@Table(name = "market_price")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MarketPrice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column
    private String symbol;
    @Column(precision = 18, scale = 4)
    private BigDecimal price;
    @Column
    private Double priceChangePercent;
}
