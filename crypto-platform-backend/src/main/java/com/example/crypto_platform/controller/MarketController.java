package com.example.crypto_platform.controller;

import com.example.crypto_platform.dto.MarketPriceDto;
import com.example.crypto_platform.service.BinanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class MarketController {

    private final BinanceService binanceService;

    @GetMapping("/prices")
    public Mono<List<MarketPriceDto>> getPrices(
            @RequestParam String symbols
    ) {
        List<String> symbolList = Arrays.asList(symbols.split(","));
        return binanceService.getCurrentPrices(symbolList);
    }
}