package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PortfolioSummaryDto {

    // Account Info
    private BigDecimal initialBalance;        // Freies Geld (Cash)
    private BigDecimal totalAssetValue;       // Wert aller Holdings
    private BigDecimal totalBalance;          // initialBalance + totalAssetValue
    private BigDecimal totalRealizedProfit;   // Realisierte Gewinne
    private BigDecimal totalUnrealizedProfit; // Unrealisierte Gewinne

    // Assets
    private List<PortfolioAssetDto> assets;
}