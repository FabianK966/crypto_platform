// com.example.crypto_platform.dto.TransactionResponseDto.java
package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TransactionResponseDto {
    private String symbol;               // Das betroffene Symbol
    private BigDecimal newBalance;       // Neue Balance des Users
    private BigDecimal realizedProfit;   // Realisierter Gewinn/Verlust (bei Sell/Delete)
    private BigDecimal newQuantity;      // Neue Quantity im Portfolio (bei Delete = 0)
    private BigDecimal avgBuyPrice;      // Aktualisierter AvgBuyPrice (bei Sell/Delete = unverändert oder null)
}