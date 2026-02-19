package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TransactionResponseDto {
    private String symbol;
    private BigDecimal newBalance;
    private BigDecimal realizedProfit;
    private BigDecimal newQuantity;
    private BigDecimal avgBuyPrice;
}