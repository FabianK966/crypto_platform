package com.example.crypto_platform.service;

import com.example.crypto_platform.dto.CandleDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class HistoricalDataService {

    private final WebClient webClient = WebClient.builder()
            .baseUrl("https://api.binance.com")
            .build();

    /**
     * Holt historische Kerzendaten von Binance
     *
     * @param symbol Trading Pair (z.B. BTCUSDT)
     * @param interval Timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d)
     * @param startTime Start timestamp in milliseconds
     * @param endTime End timestamp in milliseconds
     * @return Liste von Kerzen
     */
    public List<CandleDto> getHistoricalCandles(String symbol, String interval, Long startTime, Long endTime) {
        System.out.println("Fetching historical data for " + symbol + " (" + interval + ")");
        System.out.println("   From: " + timestampToDate(startTime) + " To: " + timestampToDate(endTime));

        List<CandleDto> allCandles = new ArrayList<>();
        Long currentStart = startTime;

        /**
         * Binance API Limit: max 1000 candles per request, Wir holen die Daten in Batches
         */
        while (currentStart < endTime) {
            try {
                Long finalCurrentStart = currentStart;
                String response = webClient.get()
                        .uri(uriBuilder -> uriBuilder
                                .path("/api/v3/klines")
                                .queryParam("symbol", symbol)
                                .queryParam("interval", interval)
                                .queryParam("startTime", finalCurrentStart)
                                .queryParam("endTime", endTime)
                                .queryParam("limit", 1000)
                                .build())
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();

                List<CandleDto> batch = parseKlines(response);

                if (batch.isEmpty()) {
                    break;
                }

                allCandles.addAll(batch);

                /**
                 * Nächster Batch startet nach der letzten Kerze
                 */
                currentStart = batch.get(batch.size() - 1).getTimestamp() + 1;

                System.out.println("   Fetched " + batch.size() + " candles (Total: " + allCandles.size() + ")");

                /**
                 * Rate limiting: kleines Delay zwischen Requests
                 */
                Thread.sleep(100);

            } catch (Exception e) {
                System.err.println("Error fetching historical data: " + e.getMessage());
                break;
            }
        }

        System.out.println("Total candles fetched: " + allCandles.size());
        return allCandles;
    }

    /**
     * Parst Binance Kline Response zu CandleDto Liste
     */
    private List<CandleDto> parseKlines(String json) {
        try {
            /**
             * Binance gibt Array von Arrays zurück: [[timestamp, open, high, low, close, volume, ...], ...]
             */
            json = json.trim();
            if (!json.startsWith("[") || !json.endsWith("]")) {
                return List.of();
            }

            List<CandleDto> candles = new ArrayList<>();
            String[] rows = json.substring(2, json.length() - 2).split("\\],\\[");

            for (String row : rows) {
                String[] values = row.replace("\"", "").split(",");

                if (values.length >= 6) {
                    CandleDto candle = new CandleDto();
                    candle.setTimestamp(Long.parseLong(values[0]));
                    candle.setOpen(new BigDecimal(values[1]));
                    candle.setHigh(new BigDecimal(values[2]));
                    candle.setLow(new BigDecimal(values[3]));
                    candle.setClose(new BigDecimal(values[4]));
                    candle.setVolume(new BigDecimal(values[5]));
                    candles.add(candle);
                }
            }

            return candles;
        } catch (Exception e) {
            System.err.println("Error parsing klines: " + e.getMessage());
            return List.of();
        }
    }

    /**
     * Hilfsmethode: Timestamp zu lesbarem Datum
     */
    private String timestampToDate(Long timestamp) {
        return LocalDateTime.ofInstant(
                Instant.ofEpochMilli(timestamp),
                ZoneId.systemDefault()
        ).toString();
    }

    /**
     * Validiert Interval String
     */
    public boolean isValidInterval(String interval) {
        List<String> validIntervals = List.of("1m", "5m", "15m", "30m", "1h", "4h", "1d");
        return validIntervals.contains(interval);
    }

    /**
     * Berechnet maximale Anzahl Kerzen für einen Zeitraum
     */
    public int getMaxCandles(String interval, Long startTime, Long endTime) {
        long diffMs = endTime - startTime;

        return switch (interval) {
            case "1m" -> (int) (diffMs / (60 * 1000));
            case "5m" -> (int) (diffMs / (5 * 60 * 1000));
            case "15m" -> (int) (diffMs / (15 * 60 * 1000));
            case "30m" -> (int) (diffMs / (30 * 60 * 1000));
            case "1h" -> (int) (diffMs / (60 * 60 * 1000));
            case "4h" -> (int) (diffMs / (4 * 60 * 60 * 1000));
            case "1d" -> (int) (diffMs / (24 * 60 * 60 * 1000));
            default -> 0;
        };
    }
}