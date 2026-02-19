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


    private BigDecimal initialBalance;
    private BigDecimal totalAssetValue;
    private BigDecimal totalBalance;
    private BigDecimal totalRealizedProfit;
    private BigDecimal totalUnrealizedProfit;
    private List<PortfolioAssetDto> assets;
}