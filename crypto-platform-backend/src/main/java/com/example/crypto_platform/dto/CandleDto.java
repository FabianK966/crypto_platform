// src/main/java/com/example/crypto_platform/dto/CandleDto.java
package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CandleDto {
    private Long timestamp;          // Unix timestamp in milliseconds
    private BigDecimal open;
    private BigDecimal high;
    private BigDecimal low;
    private BigDecimal close;
    private BigDecimal volume;
}