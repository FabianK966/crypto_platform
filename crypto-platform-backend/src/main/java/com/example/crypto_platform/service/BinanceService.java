package com.example.crypto_platform.service;


import com.example.crypto_platform.dto.MarketPriceDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BinanceService {

    private final WebClient webClient = WebClient.builder()
            .baseUrl("https://api.binance.com")
            .build();

    /**
     * Holt aktuelle Preise für mehrere Symbole
     */
    public Mono<List<MarketPriceDto>> getCurrentPrices(List<String> symbols) {
        String symbolsParam = "[" + symbols.stream()
                .map(s -> "\"" + s + "\"")
                .collect(Collectors.joining(",")) + "]";

        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v3/ticker/24hr")
                        .queryParam("symbols", symbolsParam)
                        .build())
                .retrieve()
                .bodyToFlux(Map.class)
                .map(ticker -> {
                    String symbol = (String) ticker.get("symbol");
                    String lastPrice = (String) ticker.get("lastPrice");
                    String priceChangePercent = (String) ticker.get("priceChangePercent");

                    return new MarketPriceDto(
                            symbol,
                            new BigDecimal(lastPrice),
                            new BigDecimal(priceChangePercent)
                    );
                })
                .collectList()
                .doOnError(error ->
                        System.err.println("Error fetching prices: " + error.getMessage())
                );
    }
}
