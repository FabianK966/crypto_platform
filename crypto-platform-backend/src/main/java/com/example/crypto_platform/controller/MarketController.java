package com.example.crypto_platform.controller;

import com.example.crypto_platform.dto.MarketPriceDto;
import com.example.crypto_platform.service.BinanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class MarketController {

    private final BinanceService binanceService;

    @GetMapping("/prices")
    public ResponseEntity<List<MarketPriceDto>> getPrices(
            @RequestParam String symbols
    ) {
        try {
            List<String> symbolList = Arrays.asList(symbols.split(","));
            List<MarketPriceDto> prices = binanceService.getCurrentPrices(symbolList).block();
            return ResponseEntity.ok(prices != null ? prices : List.of());
        } catch (Exception e) {
            System.err.println("Error fetching market prices: " + e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }
}