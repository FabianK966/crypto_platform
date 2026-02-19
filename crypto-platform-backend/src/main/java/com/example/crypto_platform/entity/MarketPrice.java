package com.example.crypto_platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;


@Entity
@Table(name = "market_price",
        indexes = {
                @Index(name = "idx_symbol_price_priceChangePercent",
                        columnList = "symbol,price,priceChangePercent")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MarketPrice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column
    private String symbol;
    @Column
    private Double price;
    @Column
    private Double priceChangePercent;
}
