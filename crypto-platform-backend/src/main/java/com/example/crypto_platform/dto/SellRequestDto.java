package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SellRequestDto {
    private String symbol;
    private BigDecimal quantity;
    private BigDecimal pricePerCoin;
}