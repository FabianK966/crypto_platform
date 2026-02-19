package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PortfolioAssetDto {
    private Long id;
    private String symbol;
    private BigDecimal quantity;
    private BigDecimal avgBuyPriceEur;
    private BigDecimal avgBuyPriceUsd;
    private BigDecimal currentPriceUsd;
    private BigDecimal currentValueUsd;
    private BigDecimal profitLossUsd;
    private BigDecimal profitLossPercent;
    private BigDecimal totalRealizedProfit;
}