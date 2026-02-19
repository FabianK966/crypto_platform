package com.example.crypto_platform.controller;

import com.example.crypto_platform.dto.CandleDto;
import com.example.crypto_platform.dto.ReplayConfigDto;
import com.example.crypto_platform.service.HistoricalDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/replay")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class ReplayController {

    private final HistoricalDataService historicalDataService;

    /**
     * Holt historische Kerzendaten für Replay
     */
    @PostMapping("/candles")
    public ResponseEntity<?> getReplayCandles(@RequestBody ReplayConfigDto config) {
        try {
            /**
             * Validierung
             */
            if (config.getSymbol() == null || config.getSymbol().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Symbol is required"));
            }

            if (!historicalDataService.isValidInterval(config.getInterval())) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Invalid interval. Allowed: 1m, 5m, 15m, 30m, 1h, 4h, 1d"
                ));
            }

            /**
             * Trading Pair formatieren (Symbol + USDT)
             */
            String symbol = config.getSymbol().toUpperCase().replace("USDT", "") + "USDT";

            /**
             * Daten holen
             */
            List<CandleDto> candles = historicalDataService.getHistoricalCandles(
                    symbol,
                    config.getInterval(),
                    config.getStartTime(),
                    config.getEndTime()
            );

            if (candles.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "candles", List.of(),
                        "message", "No data available for this period",
                        "count", 0
                ));
            }

            /**
             * Response mit Metadata
             */
            Map<String, Object> response = new HashMap<>();
            response.put("candles", candles);
            response.put("count", candles.size());
            response.put("symbol", symbol);
            response.put("interval", config.getInterval());
            response.put("startTime", config.getStartTime());
            response.put("endTime", config.getEndTime());

            System.out.println("Sending " + candles.size() + " candles for " + symbol + " (" + config.getInterval() + ")");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            System.err.println("Error in getReplayCandles: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Failed to fetch historical data: " + e.getMessage()
            ));
        }
    }

    /**
     * Gibt verfügbare Symbole zurück
     */
    @GetMapping("/symbols")
    public ResponseEntity<List<String>> getAvailableSymbols() {
        List<String> symbols = List.of(
                "BTC", "ETH", "BNB", "XRP", "SOL", "ADA", "DOGE", "DOT", "MATIC", "AVAX",
                "SHIB", "LTC", "LINK", "UNI", "ATOM", "ETC", "XLM", "BCH", "ALGO", "VET"
        );
        return ResponseEntity.ok(symbols);
    }

    /**
     * Gibt verfügbare Timeframes zurück
     */
    @GetMapping("/intervals")
    public ResponseEntity<List<Map<String, String>>> getAvailableIntervals() {
        List<Map<String, String>> intervals = List.of(
                Map.of("value", "1m", "label", "1 Minute"),
                Map.of("value", "5m", "label", "5 Minutes"),
                Map.of("value", "15m", "label", "15 Minutes"),
                Map.of("value", "30m", "label", "30 Minutes"),
                Map.of("value", "1h", "label", "1 Hour"),
                Map.of("value", "4h", "label", "4 Hours"),
                Map.of("value", "1d", "label", "1 Day")
        );
        return ResponseEntity.ok(intervals);
    }

    /**
     * Health Check
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "service", "replay-backtesting",
                "dataSource", "Binance Public API"
        ));
    }
}