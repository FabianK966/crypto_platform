package com.example.crypto_platform.dto;

import java.math.BigDecimal;

public class UpdateDto {
    private BigDecimal quantity;
    private BigDecimal avgBuyPriceUsd;

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getAvgBuyPriceUsd() {
        return avgBuyPriceUsd;
    }

    public void setAvgBuyPriceUsd(BigDecimal avgBuyPriceUsd) {
        this.avgBuyPriceUsd = avgBuyPriceUsd;
    }
}
