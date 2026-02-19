package com.example.crypto_platform.controller;

import com.example.crypto_platform.dto.*;
import com.example.crypto_platform.entity.PortfolioAsset;
import com.example.crypto_platform.service.PortfolioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/portfolio")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class PortfolioController {

    private final PortfolioService portfolioService;

    /**
     * Portfolio Summary mit Balance-Info
     */
    @GetMapping("/summary")
    public ResponseEntity<PortfolioSummaryDto> getPortfolioSummary() {
        return ResponseEntity.ok(portfolioService.getPortfolioSummary());
    }

    /**
     * Legacy: Nur Assets
     */
    @GetMapping
    public List<PortfolioAssetDto> getPortfolio() {
        return portfolioService.getPortfolioWithLivePrices();
    }

    @PostMapping("/buy")
    public ResponseEntity<?> buyAsset(@RequestBody BuyRequestDto request) {
        try {
            portfolioService.buyAsset(request);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @PostMapping("/sell")
    public ResponseEntity<?> sellAsset(@RequestBody SellRequestDto request) {
        try {
            portfolioService.sellAsset(request);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @PostMapping
    public PortfolioAsset addAsset(@RequestBody PortfolioAsset asset) {
        return portfolioService.addOrUpdateAsset(asset);
    }

    @DeleteMapping("/{symbol}")
    public ResponseEntity<Void> deleteAsset(@PathVariable String symbol) {
        portfolioService.deleteAsset(symbol);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<PortfolioAsset> updateAsset(
            @PathVariable Long id,
            @RequestBody UpdateDto request
    ) {
        PortfolioAsset result = portfolioService.overwriteAsset(
                id,
                request.getQuantity(),
                request.getAvgBuyPriceUsd()
        );
        return ResponseEntity.ok(result);
    }
}