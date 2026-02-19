package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MarketPriceDto {
    private String symbol;
    private BigDecimal price;
    private BigDecimal priceChangePercent;
}