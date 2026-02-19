package com.example.crypto_platform.service;

import com.example.crypto_platform.dto.*;
import com.example.crypto_platform.entity.Account;
import com.example.crypto_platform.entity.PortfolioAsset;
import com.example.crypto_platform.entity.Transaction;
import com.example.crypto_platform.repository.PortfolioAssetRepository;
import com.example.crypto_platform.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PortfolioService {

    private final PortfolioAssetRepository portfolioRepository;
    private final TransactionRepository transactionRepository;
    private final BinanceService binanceService;
    private final AccountService accountService;

    /**
     * Portfolio Summary mit Balance-Info
     */
    @Transactional(readOnly = true)
    public PortfolioSummaryDto getPortfolioSummary() {
        Account account = accountService.getOrCreateAccount();
        List<PortfolioAsset> assets = portfolioRepository.findAll();

        if (assets.isEmpty()) {
            return new PortfolioSummaryDto(
                    account.getInitialBalance(),
                    BigDecimal.ZERO,
                    account.getInitialBalance(),
                    account.getTotalRealizedProfit(),
                    BigDecimal.ZERO,
                    List.of()
            );
        }
        /**
         * Live Preise holen
         */
        List<String> symbols = assets.stream()
                .map(a -> a.getSymbol() + "USDT")
                .collect(Collectors.toList());

        List<MarketPriceDto> prices = binanceService.getCurrentPrices(symbols).block();
        Map<String, BigDecimal> priceMap = prices != null
                ? prices.stream().collect(Collectors.toMap(
                MarketPriceDto::getSymbol,
                MarketPriceDto::getPrice
        ))
                : Map.of();
        /**
         * Asset DTOs erstellen
         */
        List<PortfolioAssetDto> assetDtos = assets.stream()
                .map(asset -> {
                    String tradingPair = asset.getSymbol() + "USDT";
                    BigDecimal currentPrice = priceMap.getOrDefault(tradingPair, BigDecimal.ZERO);
                    BigDecimal currentValue = currentPrice.multiply(asset.getQuantity());
                    BigDecimal investedValue = asset.getAvgBuyPriceUsd().multiply(asset.getQuantity());
                    BigDecimal profitLoss = currentValue.subtract(investedValue);
                    BigDecimal profitLossPercent = investedValue.compareTo(BigDecimal.ZERO) > 0
                            ? profitLoss.divide(investedValue, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))
                            : BigDecimal.ZERO;

                    return new PortfolioAssetDto(
                            asset.getId(),
                            asset.getSymbol(),
                            asset.getQuantity(),
                            asset.getAvgBuyPriceEur(),
                            asset.getAvgBuyPriceUsd(),
                            currentPrice,
                            currentValue,
                            profitLoss,
                            profitLossPercent,
                            asset.getTotalRealizedProfit()
                    );
                })
                .collect(Collectors.toList());

        /**
         * Gesamtwerte berechnen
         */
        BigDecimal totalAssetValue = assetDtos.stream()
                .map(PortfolioAssetDto::getCurrentValueUsd)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalUnrealizedProfit = assetDtos.stream()
                .map(PortfolioAssetDto::getProfitLossUsd)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalBalance = account.getInitialBalance().add(totalAssetValue);

        return new PortfolioSummaryDto(
                account.getInitialBalance(),
                totalAssetValue,
                totalBalance,
                account.getTotalRealizedProfit(),
                totalUnrealizedProfit,
                assetDtos
        );
    }

    /**
     * Legacy: Nur Assets ohne Balance-Info
     */
    @Transactional(readOnly = true)
    public List<PortfolioAssetDto> getPortfolioWithLivePrices() {
        return getPortfolioSummary().getAssets();
    }

    @Transactional
    public PortfolioAsset overwriteAsset(Long id, BigDecimal quantity, BigDecimal avgBuyPriceUsd) {
        PortfolioAsset asset = portfolioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Asset not found: " + id));

        if (quantity != null) asset.setQuantity(quantity);
        if (avgBuyPriceUsd != null) asset.setAvgBuyPriceUsd(avgBuyPriceUsd);

        return portfolioRepository.save(asset);
    }

    @Transactional
    public PortfolioAsset addOrUpdateAsset(PortfolioAsset asset) {
        String normalizedSymbol = asset.getSymbol()
                .toUpperCase()
                .trim()
                .replace("USDT", "")
                .replace("BUSD", "")
                .replace("USDC", "");
        asset.setSymbol(normalizedSymbol);

        return portfolioRepository.findBySymbol(normalizedSymbol)
                .map(existing -> {
                    if (asset.getQuantity() != null) existing.setQuantity(asset.getQuantity());
                    if (asset.getAvgBuyPriceUsd() != null) existing.setAvgBuyPriceUsd(asset.getAvgBuyPriceUsd());
                    return portfolioRepository.save(existing);
                })
                .orElseGet(() -> {
                    asset.setTotalRealizedProfit(BigDecimal.ZERO);
                    return portfolioRepository.save(asset);
                });
    }

    @Transactional
    public Transaction buyAsset(BuyRequestDto request) {
        String symbol = request.getSymbol().toUpperCase().replace("USDT", "").trim();
        System.out.println("Buying " + request.getQuantity() + " " + symbol + " @ $" + request.getPricePerCoin());

        Optional<PortfolioAsset> existingAssetOpt = portfolioRepository.findBySymbol(symbol);
        PortfolioAsset asset;
        BigDecimal newQuantity;
        BigDecimal newAvgBuyPrice;

        if (existingAssetOpt.isPresent()) {
            asset = existingAssetOpt.get();
            BigDecimal totalCostOld = asset.getQuantity().multiply(asset.getAvgBuyPriceUsd());
            BigDecimal totalCostNew = request.getQuantity().multiply(request.getPricePerCoin());

            newQuantity = asset.getQuantity().add(request.getQuantity());
            newAvgBuyPrice = totalCostOld.add(totalCostNew).divide(newQuantity, 8, RoundingMode.HALF_UP);

            asset.setQuantity(newQuantity);
            asset.setAvgBuyPriceUsd(newAvgBuyPrice);
            portfolioRepository.save(asset);
        } else {
            asset = new PortfolioAsset();
            asset.setSymbol(symbol);
            asset.setQuantity(request.getQuantity());
            asset.setAvgBuyPriceUsd(request.getPricePerCoin());
            asset.setTotalRealizedProfit(BigDecimal.ZERO);
            portfolioRepository.save(asset);

            newQuantity = request.getQuantity();
            newAvgBuyPrice = request.getPricePerCoin();
        }

        Transaction transaction = new Transaction();
        transaction.setSymbol(symbol);
        transaction.setType(Transaction.TransactionType.BUY);
        transaction.setQuantity(request.getQuantity());
        transaction.setPricePerUnit(request.getPricePerCoin());
        transaction.setBuyPriceUsd(request.getPricePerCoin());
        transaction.setCostBasis(newAvgBuyPrice);
        transaction.setRealizedPnL(BigDecimal.ZERO);
        transaction.setTimestamp(LocalDateTime.now());
        transactionRepository.save(transaction);

        return transaction;
    }

    @Transactional
    public Transaction sellAsset(SellRequestDto request) {
        String symbol = request.getSymbol().toUpperCase().replace("USDT", "").trim();
        PortfolioAsset asset = portfolioRepository.findBySymbol(symbol)
                .orElseThrow(() -> new RuntimeException("Asset not found in portfolio: " + symbol));

        if (asset.getQuantity().compareTo(request.getQuantity()) < 0) {
            throw new RuntimeException("Insufficient balance! You have " + asset.getQuantity() + " but tried to sell " + request.getQuantity());
        }

        System.out.println("Selling " + request.getQuantity() + " " + symbol + " @ $" + request.getPricePerCoin());

        /**
         * Realisierten Gewinn/Verlust berechnen
         */
        BigDecimal profitPerUnit = request.getPricePerCoin().subtract(asset.getAvgBuyPriceUsd());
        BigDecimal realizedPnL = profitPerUnit.multiply(request.getQuantity());

        /**
         * Asset realized profit aktualisieren
         */
        BigDecimal currentTotal = asset.getTotalRealizedProfit() != null ? asset.getTotalRealizedProfit() : BigDecimal.ZERO;
        asset.setTotalRealizedProfit(currentTotal.add(realizedPnL));

        /**
         * Account realized profit aktualisieren
         */
        accountService.addRealizedProfit(realizedPnL);

        /**
         * Transaktion erstellen
         */
        Transaction transaction = new Transaction();
        transaction.setSymbol(symbol);
        transaction.setType(Transaction.TransactionType.SELL);
        transaction.setQuantity(request.getQuantity());
        transaction.setPricePerUnit(request.getPricePerCoin());
        transaction.setBuyPriceUsd(asset.getAvgBuyPriceUsd());
        transaction.setCostBasis(asset.getAvgBuyPriceUsd());
        transaction.setRealizedPnL(realizedPnL);
        transaction.setTimestamp(LocalDateTime.now());
        transactionRepository.save(transaction);

        /**
         * Portfolio-Menge reduzieren
         */
        BigDecimal newQuantity = asset.getQuantity().subtract(request.getQuantity());
        asset.setQuantity(newQuantity);
        portfolioRepository.save(asset);

        System.out.println("Realized P&L for this trade: $" + realizedPnL);
        System.out.println("Total realized profit for " + symbol + ": $" + asset.getTotalRealizedProfit());
        return transaction;
    }

    public BigDecimal getTotalRealizedProfit() {
        return accountService.getOrCreateAccount().getTotalRealizedProfit();
    }

    @Transactional
    public void deleteAsset(String symbol) {
        PortfolioAsset asset = portfolioRepository.findBySymbol(symbol)
                .orElseThrow(() -> new RuntimeException("Asset nicht gefunden: " + symbol));

        portfolioRepository.delete(asset);
        System.out.println("Asset deleted: " + symbol);
    }
}