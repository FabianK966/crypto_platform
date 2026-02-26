package com.example.crypto_platform.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MarketPriceDto {
    private String symbol;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "#,##0.0000")
    private BigDecimal price;
    private BigDecimal priceChangePercent;
}